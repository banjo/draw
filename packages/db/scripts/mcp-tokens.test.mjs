import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loadMigration, startPostgres } from "./postgres.mjs";

const { migration, baseline } = loadMigration("20261105120000_mcp_tokens");

const fixtures = `
INSERT INTO "User" (id, email, "updatedAt") VALUES
    (1, 'one@example.test', now()), (2, 'two@example.test', now());
`;

let sql;
let createDatabase;
let stop;

describe("MCP tokens migration (isolated PostgreSQL 17, requires Docker)", () => {
    before(async () => {
        let create;
        ({ sql, createDatabase: create, stop } = await startPostgres());
        createDatabase = () => create(baseline, fixtures);
    });

    after(() => stop?.());

    it("keeps one row per token hash", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(
            database,
            `INSERT INTO "McpToken" (id, "userId", name, "tokenHash") VALUES ('a', 1, 'Claude Code', 'hash');`
        );
        assert.throws(() =>
            sql(
                database,
                `INSERT INTO "McpToken" (id, "userId", name, "tokenHash") VALUES ('b', 2, 'opencode', 'hash');`
            )
        );
    });

    it("deletes a user's tokens with the user", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(
            database,
            `INSERT INTO "McpToken" (id, "userId", name, "tokenHash") VALUES
                ('a', 1, 'Claude Code', 'one'), ('b', 2, 'opencode', 'two');`
        );
        sql(database, `DELETE FROM "User" WHERE id = 1;`);
        assert.equal(sql(database, `SELECT string_agg(id, ',') FROM "McpToken";`), "b");
    });
});
