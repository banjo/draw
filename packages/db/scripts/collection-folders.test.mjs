import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loadMigration, startPostgres } from "./postgres.mjs";

const { migration, baseline } = loadMigration("20261027120000_collection_folders");

// Drawing 1 is in both users' collections, drawing 2 only in user 1's. "A" is the drawing.
const fixtures = `
INSERT INTO "User" (id, email, "updatedAt") VALUES
    (1, 'one@example.test', now()), (2, 'two@example.test', now());
INSERT INTO "Drawing" (id, slug, "ownerId", "updatedAt") VALUES
    (1, 'drawing-one', 1, now()), (2, 'drawing-two', NULL, now());
INSERT INTO "_Collection" ("A", "B") VALUES (1, 1), (1, 2), (2, 1);
`;

const folders = `
INSERT INTO "Folder" (id, name, color, "userId", "parentId", "updatedAt") VALUES
    (1, 'Work', '#4c6ef5', 1, NULL, now()),
    (2, 'Architecture', '#7950f2', 1, 1, now()),
    (3, 'Personal', '#f76707', 2, NULL, now());
UPDATE "CollectionEntry" SET "folderId" = 2, pinned = true WHERE "userId" = 1 AND "drawingId" = 1;
UPDATE "CollectionEntry" SET "folderId" = 1 WHERE "userId" = 1 AND "drawingId" = 2;
UPDATE "CollectionEntry" SET "folderId" = 3 WHERE "userId" = 2;
`;

let sql;
let createDatabase;
let stop;

const entries = database =>
    sql(
        database,
        `SELECT string_agg(concat_ws(':', "userId", "drawingId", coalesce("folderId"::text, '-'), pinned), ' ' ORDER BY "userId", "drawingId") FROM "CollectionEntry";`
    );

describe("collection folders migration (isolated PostgreSQL 17, requires Docker)", () => {
    before(async () => {
        let create;
        ({ sql, createDatabase: create, stop } = await startPostgres());
        createDatabase = () => create(baseline, fixtures);
    });

    after(() => stop?.());

    it("keeps every saved drawing, unsorted and unpinned, and drops the old table", () => {
        const database = createDatabase();
        sql(database, migration);
        assert.equal(entries(database), "1:1:-:f 1:2:-:f 2:1:-:f");
        assert.equal(sql(database, `SELECT to_regclass('"_Collection"') IS NULL;`), "t");
    });

    it("deletes sub-folders with their folder, and moves their drawings to unsorted", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(database, folders);
        sql(database, `DELETE FROM "Folder" WHERE id = 1;`);
        assert.equal(sql(database, `SELECT string_agg(id::text, ',') FROM "Folder";`), "3");
        assert.equal(entries(database), "1:1:-:t 1:2:-:f 2:1:3:f");
    });

    it("deletes a user's entries and folders with the user, and entries with the drawing", () => {
        const database = createDatabase();
        sql(database, migration);
        sql(database, folders);
        sql(database, `DELETE FROM "User" WHERE id = 1;`);
        assert.equal(entries(database), "2:1:3:f");
        assert.equal(sql(database, `SELECT count(*) FROM "Folder";`), "1");
        sql(database, `DELETE FROM "Drawing" WHERE id = 1;`);
        assert.equal(sql(database, `SELECT count(*) FROM "CollectionEntry";`), "0");
    });

    it("keeps a drawing once per collection", () => {
        const database = createDatabase();
        sql(database, migration);
        assert.throws(
            () => sql(database, `INSERT INTO "CollectionEntry" ("userId", "drawingId") VALUES (1, 1);`),
            /duplicate key/
        );
    });
});
