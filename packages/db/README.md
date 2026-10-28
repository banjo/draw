# Database migrations

## Step 7: indexes and foreign keys

`20261026130000_database_relations` switches from Prisma-emulated relations to PostgreSQL
foreign keys. It adds indexes on `Session.userId`, `OauthAccount.userId`, and
`Drawing.ownerId`. `DrawingElement.drawingId` already has a suitable composite index.

Deleting a user deletes their sessions, OAuth accounts, and collection entries, but keeps
their drawings with a null owner. Deleting a drawing deletes its elements and collection
entries. The migration also removes the unused `Drawing.data` column; element contents stay
in `DrawingElement.data`.

The migration runs in a transaction with a 10-second lock timeout. It refuses to discard
nonempty legacy drawing data or silently delete orphaned rows. If either exists, resolve it
with a backup and a reviewed data migration before retrying.

### Preflight

Run this read-only query against the intended database. Every count must be zero:

```sql
SELECT 'orphan sessions' AS check_name, count(*) FROM "Session" s
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = s."userId")
UNION ALL
SELECT 'orphan OAuth accounts', count(*) FROM "OauthAccount" a
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."userId")
UNION ALL
SELECT 'orphan drawing owners', count(*) FROM "Drawing" d
WHERE d."ownerId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = d."ownerId")
UNION ALL
SELECT 'orphan drawing elements', count(*) FROM "DrawingElement" e
WHERE NOT EXISTS (SELECT 1 FROM "Drawing" d WHERE d.id = e."drawingId")
UNION ALL
SELECT 'orphan collection drawings', count(*) FROM "_Collection" c
WHERE NOT EXISTS (SELECT 1 FROM "Drawing" d WHERE d.id = c."A")
UNION ALL
SELECT 'orphan collection users', count(*) FROM "_Collection" c
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."B")
UNION ALL
SELECT 'drawings with legacy data', count(*) FROM "Drawing"
WHERE cardinality(data) > 0;
```

The remote audit on October 26, 2026 found no orphans and no nonempty legacy data among
131 drawings and 5,038 elements. Repeat the preflight before rollout; these counts can change.

### Rollout order

1. Build and deploy every API instance with the regenerated Prisma client from the new
   schema (`pnpm --filter db db:generate`, also run by the DB build). This client works
   while the old column still exists. Confirm no old API instances remain: their generated
   clients still select `Drawing.data`, even though the application doesn't use it.
2. Take a current database backup. Keep it outside the repository in durable storage.
3. Repeat the preflight, then run `pnpm --filter db db:migrate:prod` with the **remote**
   `DATABASE_URL` injected by the deployment environment. Don't rely on `packages/db/.env`,
   which targets the local database. This step applies all pending migrations, not just this one.
4. Confirm Prisma reports no pending migrations, all six foreign keys are validated, and the
   three new indexes exist. Smoke-test sign-in, drawing creation, collection changes, and
   saving/reopening a drawing.

Do not roll back to an API with the old generated client after dropping the column without
first restoring the column. A failed SQL transaction rolls back its schema changes, but
Prisma may still record a failed migration; inspect that record before resolving and retrying.

### Tests

```sh
pnpm --filter db test:migrations
# Or, from the repository root without pnpm:
node --test packages/db/scripts/*.test.mjs
```

Tests require Docker. They replay the existing migrations in a disposable PostgreSQL 17.5
container, seed synthetic data, and test indexes, foreign keys, cascades, and rollback on
orphaned rows or legacy data. The container has no network access or published ports, never
uses `.env` or a real database, and is removed after the suite.

## Collection folders

`20261027120000_collection_folders` replaces Prisma's implicit `_Collection` table with
`CollectionEntry`: one row per user and saved drawing, with its folder and whether it's
pinned. It also adds `Folder`. Every saved drawing is copied over, unsorted.

Deleting a folder deletes its sub-folders, and their drawings go back to unsorted. Deleting
a user deletes their folders and collection entries.

The API container applies it on start. Deploy the API first, then the web app: the old web
app's collection sidebar fails to load against the new API until the web app is deployed.
