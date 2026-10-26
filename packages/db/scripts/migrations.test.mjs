import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { setTimeout } from "node:timers/promises";

const migrationsDir = new URL("../prisma/migrations/", import.meta.url);
const migrationName = "20261026130000_database_relations";
const migration = readFileSync(new URL(`${migrationName}/migration.sql`, migrationsDir), "utf8");
const baseline = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name < migrationName)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => readFileSync(new URL(`${entry.name}/migration.sql`, migrationsDir), "utf8"))
    .join("\n");

const fixtures = `
INSERT INTO "User" (id, email, "updatedAt") VALUES
    (1, 'one@example.test', now()), (2, 'two@example.test', now());
INSERT INTO "Drawing" (id, slug, "ownerId", "updatedAt") VALUES
    (1, 'drawing-one', 1, now()), (2, 'drawing-two', NULL, now());
INSERT INTO "Session" (id, "userId", "expiresAt") VALUES
    ('one', 1, now() + interval '1 day'), ('two', 2, now() + interval '1 day');
INSERT INTO "OauthAccount" (provider, "providerUserId", "userId", "updatedAt") VALUES
    ('github', 'one', 1, now()), ('github', 'two', 2, now());
INSERT INTO "DrawingElement" (id, "elementId", version, data, "drawingId", "updatedAt") VALUES
    (1, 'element-one', 1, '{"id":"element-one"}', 1, now()),
    (2, 'element-two', 1, '{"id":"element-two"}', 2, now());
INSERT INTO "_Collection" ("A", "B") VALUES (1, 1), (1, 2), (2, 1);
`;

let container;
let databaseNumber = 0;

const docker = (args, input) => {
    const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000 });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.error?.message || "Docker command failed");
    }
    return result.stdout.trim();
};

const sql = (database, input) =>
    docker(
        [
            "exec",
            "-i",
            container,
            "psql",
            "-X",
            "-U",
            "postgres",
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            "-Atq",
        ],
        input
    );

const createDatabase = () => {
    const database = `migration_test_${++databaseNumber}`;
    sql("postgres", `CREATE DATABASE "${database}";`);
    sql(database, baseline);
    sql(database, fixtures);
    return database;
};

const counts = database =>
    JSON.parse(
        sql(
            database,
            `SELECT json_build_object(
    'users', (SELECT count(*) FROM "User"),
    'sessions', (SELECT count(*) FROM "Session"),
    'accounts', (SELECT count(*) FROM "OauthAccount"),
    'drawings', (SELECT count(*) FROM "Drawing"),
    'elements', (SELECT count(*) FROM "DrawingElement"),
    'collections', (SELECT count(*) FROM "_Collection")
);`
        )
    );

describe("database relation migration (isolated PostgreSQL 17, requires Docker)", () => {
    before(async () => {
        container = docker([
            "run",
            "--detach",
            "--rm",
            "--network",
            "none",
            "--name",
            `banjodraw-migrations-${randomUUID()}`,
            "--env",
            "POSTGRES_HOST_AUTH_METHOD=trust",
            "postgres:17.5-alpine",
        ]);
        for (let attempt = 0; attempt < 60; attempt++) {
            try {
                // Wait until the entrypoint has replaced itself with the final server.
                docker(["exec", container, "sh", "-c", 'test "$(cat /proc/1/comm)" = postgres']);
                sql("postgres", "SELECT 1;");
                return;
            } catch {
                await setTimeout(500);
            }
        }
        throw new Error("Test PostgreSQL did not start");
    });

    after(() => {
        if (container) {
            docker(["rm", "--force", "--volumes", container]);
        }
    });

    it("preserves rows and element contents, adds indexes and six validated foreign keys", () => {
        const database = createDatabase();
        sql(database, `UPDATE "Drawing" SET data=ARRAY[]::jsonb[] WHERE id=1;`);
        const beforeCounts = counts(database);
        sql(database, migration);
        assert.deepEqual(counts(database), beforeCounts);
        assert.equal(
            sql(database, `SELECT data->>'id' FROM "DrawingElement" WHERE id=1;`),
            "element-one"
        );
        assert.equal(
            sql(database, `SELECT count(*) FROM pg_constraint WHERE contype='f' AND convalidated;`),
            "6"
        );
        assert.equal(
            sql(
                database,
                `SELECT count(*) FROM pg_indexes WHERE indexname IN ('Session_userId_idx', 'OauthAccount_userId_idx', 'Drawing_ownerId_idx');`
            ),
            "3"
        );
        assert.equal(
            sql(
                database,
                `SELECT count(*) FROM information_schema.columns WHERE table_name='Drawing' AND column_name='data';`
            ),
            "0"
        );
    });

    it("cascades account, session and collection deletion, but preserves owned drawings", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(database, `DELETE FROM "User" WHERE id=1;`);
        assert.deepEqual(counts(database), {
            users: 1,
            sessions: 1,
            accounts: 1,
            drawings: 2,
            elements: 2,
            collections: 1,
        });
        assert.equal(sql(database, `SELECT "ownerId" IS NULL FROM "Drawing" WHERE id=1;`), "t");
    });

    it("cascades drawing deletion to its elements and collection entries only", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(database, `DELETE FROM "Drawing" WHERE id=1;`);
        assert.deepEqual(counts(database), {
            users: 2,
            sessions: 2,
            accounts: 2,
            drawings: 1,
            elements: 1,
            collections: 1,
        });
        assert.equal(sql(database, `SELECT "elementId" FROM "DrawingElement";`), "element-two");
    });

    it("cascades changes to referenced user and drawing ids", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(
            database,
            `UPDATE "User" SET id=100 WHERE id=1; UPDATE "Drawing" SET id=200 WHERE id=1;`
        );
        assert.equal(sql(database, `SELECT "userId" FROM "Session" WHERE id='one';`), "100");
        assert.equal(
            sql(database, `SELECT "userId" FROM "OauthAccount" WHERE "providerUserId"='one';`),
            "100"
        );
        assert.equal(sql(database, `SELECT "ownerId" FROM "Drawing" WHERE id=200;`), "100");
        assert.equal(sql(database, `SELECT "drawingId" FROM "DrawingElement" WHERE id=1;`), "200");
        assert.equal(
            sql(database, `SELECT count(*) FROM "_Collection" WHERE "A"=200 AND "B"=100;`),
            "1"
        );
    });

    const orphanChanges = [
        ["session", `UPDATE "Session" SET "userId"=999 WHERE id='one';`],
        ["OAuth account", `UPDATE "OauthAccount" SET "userId"=999 WHERE "providerUserId"='one';`],
        ["drawing owner", `UPDATE "Drawing" SET "ownerId"=999 WHERE id=1;`],
        ["drawing element", `UPDATE "DrawingElement" SET "drawingId"=999 WHERE id=1;`],
        ["collection drawing", `UPDATE "_Collection" SET "A"=999 WHERE "A"=1;`],
        ["collection user", `UPDATE "_Collection" SET "B"=999 WHERE "B"=1;`],
    ];

    for (const [relation, change] of orphanChanges) {
        it(`rejects orphaned ${relation} rows without deleting data or partially applying DDL`, () => {
            const database = createDatabase();
            sql(database, change);
            const beforeCounts = counts(database);
            assert.throws(() => sql(database, migration), /violates foreign key constraint/);
            assert.deepEqual(counts(database), beforeCounts);
            assert.equal(
                sql(database, `SELECT count(*) FROM pg_constraint WHERE contype='f';`),
                "0"
            );
            assert.equal(
                sql(
                    database,
                    `SELECT count(*) FROM pg_indexes WHERE indexname='Session_userId_idx';`
                ),
                "0"
            );
            assert.equal(
                sql(
                    database,
                    `SELECT count(*) FROM information_schema.columns WHERE table_name='Drawing' AND column_name='data';`
                ),
                "1"
            );
        });
    }

    it("prevents new orphaned rows after migration", () => {
        const database = createDatabase();
        sql(database, migration);
        for (const [, change] of orphanChanges) {
            assert.throws(() => sql(database, change), /violates foreign key constraint/);
        }
    });

    it("refuses to drop nonempty legacy drawing data", () => {
        const database = createDatabase();
        sql(database, `UPDATE "Drawing" SET data=ARRAY['{"id":"legacy"}'::jsonb] WHERE id=1;`);
        assert.throws(
            () => sql(database, migration),
            /Drawing.data still contains legacy elements/
        );
        assert.equal(sql(database, `SELECT data[1]->>'id' FROM "Drawing" WHERE id=1;`), "legacy");
        assert.equal(sql(database, `SELECT count(*) FROM pg_constraint WHERE contype='f';`), "0");
    });
});
