import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loadMigration, startPostgres } from "./postgres.mjs";

const { migration, baseline } = loadMigration("20261030140000_link_access");

const fixtures = `
INSERT INTO "User" (id, email, "updatedAt") VALUES (1, 'one@example.test', now());
INSERT INTO "Drawing" (id, slug, "ownerId", "updatedAt") VALUES
    (1, 'drawing-one', 1, now()), (2, 'drawing-two', NULL, now());
`;

let sql;
let createDatabase;
let stop;

describe("link access migration (isolated PostgreSQL 17, requires Docker)", () => {
    before(async () => {
        let create;
        ({ sql, createDatabase: create, stop } = await startPostgres());
        createDatabase = () => create(baseline, fixtures);
    });

    after(() => stop?.());

    it("lets anyone with the link edit every existing drawing, and drops the old column", () => {
        const database = createDatabase();
        sql(database, migration);
        assert.equal(
            sql(database, `SELECT string_agg("linkAccess"::text, ' ' ORDER BY id) FROM "Drawing";`),
            "edit edit"
        );
        assert.equal(
            sql(
                database,
                `SELECT count(*) FROM information_schema.columns WHERE table_name = 'Drawing' AND column_name = 'access';`
            ),
            "0"
        );
        assert.equal(sql(database, `SELECT to_regtype('"Access"') IS NULL;`), "t");
    });

    it("gives new drawings edit access by default", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(
            database,
            `INSERT INTO "Drawing" (id, slug, "updatedAt") VALUES (3, 'drawing-three', now());`
        );
        assert.equal(sql(database, `SELECT "linkAccess" FROM "Drawing" WHERE id = 3;`), "edit");
    });
});
