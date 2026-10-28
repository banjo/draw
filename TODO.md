# Fix list

From a code review in October 2026. Fix these in order. Steps 1 to 3 are about losing or
wiping drawings, and matter most. Steps 1 and 2 should go in one release, because step 2
changes how changes are merged on both the client and the server.

## 1. Switching drawings can wipe the new one

`/` and `/draw/:slug` render the same `<DrawContainer />` (`apps/web/src/routes/root.tsx`),
so `Draw` isn't remounted when the slug changes. Two bugs come from that.

**The last change is sent to the next drawing.** In `use-delta-mutation.ts`, `deltaUpdate`
is never reset after it's sent, and the send effect depends on `slug`. When you go from
drawing A to drawing B (sidebar card, "New drawing", "Create copy"), A's last change is sent
to B. If it has an `order` (any add or delete sets one), `DeltaUpdateUtil.applyToBoard`
rebuilds B from A's order and drops everything else. The server then saves that, and the
other people on B get it too.

**Errors overwrite the offline drawing.** When the board subscription fails,
`use-board-collaboration.tsx` calls `navigate("/")`. `slug` becomes `undefined` while
`elements` still holds `[]` or the remote drawing, and the effect in `use-elements-state.ts`
writes that to `drawing-base` in localStorage. The offline drawing is gone.

**Fix**

- [x] Add `key={slug ?? "local"}` on `<Draw>` in `draw-container.tsx`, so all drawing state
      resets when the slug changes. The key is on a `GlobalContextProvider` moved there from
      `app.tsx`, so each drawing also gets a fresh `excalidrawApi`.
- [x] Reset the pending change after sending it. Not needed anymore: the slug can't change
      within one `Draw`, so the old change can't be re-sent. Step 2 rewrites this hook anyway.
- [x] Only write to localStorage once the local drawing has actually loaded. Covered by the
      remount: on `/`, `elements` starts from localStorage.
- [x] Create the router once at module level in `root.tsx`.
- [x] Keep the collection sidebar open across the remount (`use-sidebar-store.ts`, passed as
      `initialData.appState.openSidebar`).
- [x] Upload the images of an offline drawing before Share or Save to collection. This used to
      happen only because `Draw` survived the navigation.
- [x] "Offline mode" uses `navigate("/")` instead of a full reload.
- [x] Disconnect the old toolbar `ResizeObserver` when the toolbar is set up again.
- [x] Only subscribe to the board once `excalidrawApi` is set. Otherwise the full board can
      be dropped and the loading overlay stays up (seen once on reload while testing).
- [x] Test in the browser (Oct 26, local API + DB, Chrome): switching drawings, error → offline
      drawing, offline mode, sharing an offline drawing, sharing with an image (fails cleanly
      with dummy R2 credentials), the sidebar open and docked, and the add-element button.
      On the old code, New drawing sent A's last change and A's elements as deletions to B.
- [x] Test a successful image upload. Done against a local S3 (S3Proxy in
      `docker/docker-compose.yml`, `CLOUDFLARE_ENDPOINT`): sharing an offline drawing uploads
      the image, and the shared drawing loads it from the bucket after a reload.

## 2. Collaboration loses changes

**The throttle drops changes.** Each `BoardDeltaUpdate` only holds the elements that changed
since the previous `onChange`. `useThrottle` keeps only the newest value, so two changes
within 30 ms that touch different elements lose the first one for good. This happens for
text inside a box, duplicating, and adding then deleting.

**The merge deletes other people's new elements.**
`packages/common/src/utils/delta-update-util.ts` rebuilds the board from `deltaUpdate.order`
only. If B sends a change before receiving A's new element X, X is missing from B's order
and disappears for everyone. Also:

- On the client (`isOnClient: true`), remote elements always replace local ones, without
  comparing `version`, so clients drift apart.
- When `order` is missing, elements in `added` are dropped.
- `order` ids are strings while element ids can be numbers, so `===` can miss.
- `added.find` and `updatedBoardElements.find` inside a map are O(n·m).

**Code block edits aren't synced or saved.** `code-editor.tsx` and `code-editor-menu.tsx`
change elements in place through `UpdateElementUtil.mutateElement`, which only bumps
`version`. Excalidraw never fires `onChange`, so nothing is sent or saved, and a reload loses
the code. The next remote change is applied on top of the React `elements` state, which
doesn't have the edit, so it's overwritten.

**Fix**

- [x] Collect changes instead of replacing them: `use-board-sync.ts` diffs the live scene
      against the versions the server has, on a 30 ms timer, so nothing is lost and elements
      changed in place are picked up. It also sends what's left when the drawing unmounts.
- [x] In `applyToBoard`, never drop elements that aren't in `order`; add them at the end.
      (Fractional indices need a newer Excalidraw, see step 12.)
- [x] Merge by `version`, with the lower `versionNonce` winning a tie (Excalidraw's rule), on
      the server and the client (`DeltaUpdateUtil.mergeElements`). Deleted elements are kept
      as tombstones, so an older copy can't bring them back.
- [x] Handle a missing `order` (keep `added`), compare ids as strings, and use a `Map` by id.
- [x] Code blocks: typing changes the scene's copy and tells Excalidraw (debounced), and the
      menu updates the element through `updateScene`.
- [x] Apply remote changes to `excalidrawApi.getSceneElementsIncludingDeleted()`, and leave
      the element being edited, dragged, resized, or typed in alone.
- [x] Stop the echo on load: the full board is marked as synced.
- [x] Code block language and font size are read from `element.customData`.
- [x] The client id is per tab (sessionStorage). It was shared through localStorage, so two
      tabs in the same browser ignored each other's changes.
- [x] `UpdateElementUtil` sets a new `versionNonce` with each version, like Excalidraw.
- [x] Tests for the merge in `packages/common` (`pnpm --filter common test`).
- [x] Tested in Chrome with two tabs (Oct 26): two changes 5 ms apart both arrive, loading
      sends nothing back, code, language, and font size sync and reach the database, a
      change right before switching drawings is sent, and a stale order from another client
      keeps the elements it didn't list.

## 3. The server's in-memory boards and saves

**`DrawingEmitter` has races** (`packages/server/src/model/drawing-emitter.ts`):

- Two `update()` calls for a board that isn't in memory both load it from the database and
  apply their change to separate copies. The second `boardsMap.set` wins and the first change
  is lost. `get()` racing with `update()` does the same.
- `get()` does `this.saveIntervalMap.delete(slug)` without `clearInterval`, so a second
  subscriber leaks the first interval. The interval clears itself with
  `clearInterval(this.saveIntervalMap.get(slug))` instead of its own handle, so a leaked one
  runs every minute forever.
- `complete()` always clears the board after 30 seconds, even if someone rejoined. Changes
  that arrive during the final save are dropped, and the next load reads old data.
- A board loaded by `update()` alone gets no save interval.
- If the drawing doesn't exist, `update()` returns `undefined` and the mutation succeeds.

**Leaving doesn't work.** `collaboratorsEmitter.remove()` is never called. The teardown in
`collaboration.ts` removes the collaborator from the shared array but only emits to the
closing subscriber, so everyone else keeps a ghost cursor and the map never shrinks. Board
cleanup runs only when `activeCollaborators(slug) === 0`, which doesn't count viewers who
never moved their pointer, and depends on teardown order.

**Saves aren't atomic.** `DrawRepository.saveDrawingFromDeltaUpdate` runs `deleteMany`,
`createMany`, and `drawing.update` with no transaction (there's a `// TODO`). A failure
halfway leaves the drawing empty, and two saves at once fail on
`@@unique([drawingId, elementId])`. It ignores element `version`, and the new-drawing branch
inserts deleted elements too. In `saveDrawingFromBoard`, the create branch uses
`prisma.drawing.create` instead of `tx.drawing.create`.

**Two writers.** The server saves from memory every minute, and the client calls
`saveDrawing` on its own (`use-drawing.ts`). Whichever runs last wins.

**Shutdown loses edits.** On SIGTERM only `wss.close()` runs. Boards in memory aren't saved,
so a deploy can lose up to a minute of edits. `uncaughtException` only logs and keeps the
process running.

**Fix**

- [x] Keep a `Map<Slug, Promise<...>>` for loading, so concurrent callers share one fetch.
- [x] One session per open drawing with its own save interval, cleared when the session ends.
- [x] One cancellable eviction timer per drawing, cancelled when someone joins. After the last
      save it checks again for subscribers and new changes before removing the drawing.
- [x] Count board subscribers per drawing (`join`/`leave`), separately from cursors. The
      subscription joins inside the observable, so closing it while loading can't leak.
- [x] Call `collaboratorsEmitter.remove(slug, clientId)` in teardown, so everyone's cursor list
      updates, and delete empty drawings from the map.
- [x] Return NOT_FOUND from `updateBoard` when the drawing doesn't exist.
- [x] Saves of a drawing run one after the other, and a failed save is retried. Both
      repository saves run in one transaction, with `tx` everywhere.
- [x] ~~Pick one writer while collaborating.~~ Not an issue: the client only saves new
      drawings (Share, Create copy, New drawing). Existing ones are saved by the server only.
- [x] On SIGTERM, SIGINT, and `uncaughtException`, save every open drawing (10 s limit), then
      exit.
- [x] Events per drawing (`update:<slug>`, `change:<slug>`), with no listener limit.
- [x] Remove elements deleted more than a day ago when saving (`updated` is now set by
      `UpdateElementUtil` too).
- [x] Tests for `DrawingEmitter` in `packages/server` (`pnpm --filter server test`).
- [x] Tested locally (Oct 26): a closed tab's cursor disappears for the others, restarting the
      API right after a change saves it first and the page reconnects, and leaving a drawing
      saves it and frees the memory after 30 s.

## 4. Anyone with a link can change any drawing

`saveDrawing` and every procedure in `collaboration.ts` are `publicProcedure`. The WebSocket
context in `apps/api/src/lib/ws.ts` never reads the session (`// TODO: auth does not work
with ws for now`). `Drawing.access` (`public` / `private` / `restricted`) is never checked.
Only renaming checks `ownerId`. So anyone who knows a slug can change or delete every element
of a drawing. (Before step 2, a single change with `order: []` emptied it.) `saveDrawing` on
an existing slug also overwrites the database copy while the drawing may be open in memory,
and the next save from memory overwrites it back. The app only calls it for new slugs.

`updateCollaborator` takes `name`, `avatarUrl`, `userId`, and `clientId` from the client, so
anyone can add fake cursors, take over another client's cursor, or make everyone's browser
load any image URL.

**Fix**

Decided (Oct 26): keep "anyone with the link can edit", like excalidraw.com. Signed-out users
can create drawings, and `private`/`restricted` wait until there's a feature that needs them.

- [x] Decide the rules first (see above).
- [x] Read the Lucia session cookie in the WebSocket `createContext` (`createWSContext`), which
      also gives each connection an id.
- [ ] ~~Check `access` and `ownerId`~~ Not needed with the link model. If private drawings are
      added later: owner-only, behind a toggle, and drop `restricted`.
- [x] Cursors are keyed by WebSocket connection and get their name and avatar from the session
      on the server. Anonymous users send only a name (max 50 characters). The client id is
      gone, and the server doesn't send a change back to the connection that sent it.
- [x] New slugs must be UUIDs (`SlugSchema`). Lookups accept any string up to 100 characters
      (`ExistingSlugSchema`), in case production has older slugs.
- [x] `saveDrawing` only creates drawings and returns CONFLICT for an existing slug.
- [x] `getDrawing` returns NOT_FOUND.
- [x] Collaboration calls only work over WebSocket.
- [x] Tested against the local API (Oct 26): a guessable slug, overwriting a drawing, a cursor
      over HTTP, and a too-long name are rejected, a fake avatar and ids are ignored, a
      signed-in WebSocket gets the account's name and avatar, and in Chrome two tabs, New
      drawing, Create copy, and Share work.

## 5. Image uploads

**Anyone can overwrite any image.** `saveImagesByPresignedUrl` (`packages/server/src/trpc/
router/file.ts`) is public. `FileRepository.savePresignedImageFiles` skips existing ids for
the database insert, but `BucketService.createFileImageKeys(images)` still creates upload
URLs for all of them. Image ids are in the drawing data, and the key
`image/<ext>/<id>.<ext>` isn't scoped to a drawing, so replacing one replaces it everywhere.

**No limits.** `mimeType` is any string, so `mime.extension()` can give `html` or `exe`. The
upload URL doesn't limit size or content type. The API has no `maxBodySize`, the WebSocket
server allows 100 MB messages, and the element arrays have no `.max()`.

**`BucketFile` has no unique id or owner.** `imageId` isn't unique or indexed, the
check-then-insert can create duplicates, and rows are written before the upload happens. There
is no link to a drawing or user, so images can't be checked or cleaned up.

**The client uploads the same image many times.** `use-images.ts` runs on every `elements`
change, and the "already uploaded" list is only updated after the upload finishes. Dragging a
pasted image starts a new upload on every change. Completions overwrite each other through
the stale `uploadedImages`, failures retry and show an error toast on every change, and the
`fetchImages` and IndexedDB calls aren't caught. After switching drawing, the old drawing's
images are uploaded under the new slug.

**Fix**

Decided with step 4: no session needed (signed-out users share drawings with images), and keys
stay global so "Create copy" can reuse the images. Instead, an uploaded image can't be
replaced.

- [x] Only create upload URLs for images that aren't in the bucket yet: new rows, or rows
      whose upload never finished (checked with `HeadObject`), so a failed upload can retry.
- [ ] ~~Require a session and scope keys by drawing~~ See above.
- [x] Allow only image types (`IMAGE_MIME_TYPES` in `common`), and sign `ContentType` and
      `ContentLength` into the upload URL, so the bucket rejects any other upload (403). Max
      5 MB, checked in the browser first.
- [x] Validate `imageId` (`ImageIdSchema`, `/^[\w-]{1,128}$/`).
- [x] `maxBodySize` (10 MB) on the tRPC Express middleware, `maxPayload` (10 MB) on the
      WebSocket server, and `.max()` on element, order, and image arrays.
- [x] `BucketFile.imageId` is unique (migration removes duplicates first), and new rows use
      `createMany({ skipDuplicates: true })`.
- [x] On the client, each image is saved or loaded once at a time, failures wait 30 s before
      the next try, errors are caught, and a failure toasts once. Images loaded from the
      bucket aren't uploaded again.
- [x] `LocalImageService` waits for the database before every call. The unused single-image
      methods, including the broken `loadImage`, are gone.
- [x] Tested against the local API and S3 (Oct 26): wrong type, bad id, too large, and too
      many images are rejected, an upload with another size or type gets 403, an uploaded
      image gets no new URL, and an unfinished one can retry. In Chrome: an image dragged
      10 times uploads once, loads after a reload, an 8.6 MB image toasts once without a
      request, offline images survive a reload and are removed when deleted, and sharing
      uploads once.
- [ ] Not tested against real R2: that it enforces the signed `Content-Length`.
- [ ] Rate-limit `saveDrawing` and `saveImagesByPresignedUrl` per IP. Without sign-in, that's
      what keeps someone from filling the database and bucket.

## 6. Login

- **Google accounts can be taken over.** `callback.ts` links accounts by email, and
  `google.ts` parses `email_verified` but never checks it.
- **Google ids get corrupted.** `id: Number.parseInt(googleUser.sub)` loses digits, since
  Google ids are about 21 digits. Two users can get the same `providerUserId`, and the second
  one can't sign up.
- **GitHub users with a private email can't log in.** No scopes are requested, `/user` returns
  `email: null`, and `OauthUserInfo.parse` in `github.ts` throws outside `wrapAsync`.
- **Errors hang requests.** Express 4 doesn't catch rejected async handlers. A database error
  in `lucia.validateSession`, an expired or reused OAuth code in
  `validateAuthorizationCode`, or a failed `createSession` leaves the request hanging.
- **Logs leak secrets.** The "Invalid state" log includes `code` and `codeVerifier`, and
  emails are logged at `info`. Prisma and S3 error messages are sent to the client.
- The state and verifier cookies are never cleared, `/logout` is a GET, and emails are
  compared case-sensitively.
- Renaming someone else's drawing returns `INTERNAL_SERVER_ERROR`.
  `updateDrawingName` returns `Result.error("...")` without `{ type: "Unauthorized" }`, so the
  router's check never matches.
- All requests share one log context. `node-context.ts` passes the same module-level `store`
  to `context.run` for every request, so request ids and user ids get mixed up in the logs.

**Fix**

- [x] Sign in with a known provider account first (`findOrCreateUser`). Link by email, or
      create a user, only when the provider verified the email (Google `email_verified`,
      GitHub's primary email `verified`). Unverified emails get a 401.
- [x] `OauthUserInfo.id` is a string, and Google's `sub` is used as is. A user whose stored
      Google id is wrong is matched by their verified email on the next login, and the old
      account row is replaced (`linkOauthAccount`).
- [x] Request `user:email` from GitHub and use the primary email from `/user/emails`.
- [x] `handleErrors` wraps the async Express handlers and the auth middleware, and
      `errorMiddleware` answers 500. An invalid or reused OAuth code is caught and gets a 401.
- [x] No `code`, `codeVerifier`, or emails in logs, and generic error messages to clients.
- [x] OAuth cookies are cleared after the callback, logout is a POST (the client reloads
      after it, so the WebSocket loses the session), and emails are lowercased and compared
      without case.
- [x] `updateDrawingName` returns `{ type: "Unauthorized" }`, sent as FORBIDDEN.
- [x] A new log context per request (`NodeContext.run`), in Express and tRPC.
- [x] Tests for `findOrCreateUser` in `packages/server`.
- [x] Tested against the local API (Oct 26): GitHub asks for `user:email`, the OAuth cookies
      are `SameSite=Lax` and cleared after the callback, a bad state or code gets a 401 in
      under a second (it used to hang), the database being down gets a 500 instead of a hang,
      `GET /logout` is gone and `POST /logout` ends the session, renaming someone else's
      drawing gets FORBIDDEN, and the logs only have flags. Signing out works in Chrome.
- [ ] Not tested: a real Google or GitHub login, which needs real OAuth apps locally. Try
      both after deploying, including a GitHub account with a private email.
- [ ] Lucia is deprecated. Plan a move to the copy-the-code version of Lucia or to Better Auth,
      and update `arctic`.

## 7. Database indexes and foreign keys

`schema.prisma` uses `relationMode = "prisma"` on Postgres, so there are no foreign keys and
no indexes on relation fields. `Session.userId`, `OauthAccount.userId`, and `Drawing.ownerId`
have no indexes, and nothing stops orphaned rows.

**Fix**

- [x] Remove `relationMode = "prisma"` so Postgres creates real foreign keys, including
      `_Collection`. The remote audit found no orphans. The migration rejects orphaned rows
      instead of silently deleting them, and runs in one transaction.
- [x] Add `@@index([userId])` on `Session` and `OauthAccount`, and `@@index([ownerId])`
      on `Drawing`. Foreign keys don't create these indexes automatically.
- [x] Add `onDelete: Cascade` on `DrawingElement.drawing` and `OauthAccount.user`.
- [x] Remove `Drawing.data` from the schema and prepare its removal in the migration. No
      remote drawings contain legacy data; the migration refuses to drop nonempty data.
- [x] In `draw-repository.ts`, build a `Map` of elements by id before ordering them (step 3).
- [x] Twelve PostgreSQL 17 migration tests cover preservation, indexes, foreign keys,
      cascades, orphan rejection, and rollback. DB/server/API typechecks and the 29 existing
      server/common tests pass. Rollout instructions are in `packages/db/README.md`.
- [x] Deploy the regenerated Prisma client, back up the database, then apply
      `20261026130000_database_relations` remotely. Done Oct 26 after deployment: all 17
      migrations applied, six validated foreign keys, three valid indexes, and all row
      counts unchanged (131 drawings, 5,038 elements). A verified full backup is stored
      outside the repository under `~/.local/share/banjodraw/backups/`.

## 8. Local setup

- `apps/api/.env.example` is missing `DATABASE_URL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`, which `ServerEnvSchema` requires, so the
  API doesn't start. It still has `WS_PORT`, which nothing reads.
- Empty values like `LOG_LEVEL=` and `VITE_LOCAL_DEVELOPMENT=` load as `""` and fail the
  `z.enum(...).optional()` checks.
- `pnpm db:reset` fails at the last step: `db:seed` runs `esno`, which isn't installed.
- With `VITE_LOCAL_DEVELOPMENT=true`, the app is stuck on "Loading...". `AuthService`
  notifies listeners in the constructor, before any exist, and
  `checkIfUserIsAuthenticated()` returns early without notifying.
- `turbo.json`: `typecheck` doesn't depend on `db:generate`, `outputs` is `dist` instead of
  `dist/**`, `.env` files aren't hashed, and `dev` isn't `persistent`.
- `vite.config.ts` sets port 3000 but the script uses `--port 3005`, sets `host: "0.0.0.0"`,
  and externalises `ui/styles/globals.css`, which doesn't exist.

**Fix**

- [x] `.env.example` files have every variable the schemas need, with working local values
      (Docker Postgres and S3). `WS_PORT`, `VITE_DEV`, the unused `DEVELOPMENT_UID` and
      `VITE_DEVELOPMENT_UID`, and the Axiom-only `packages/common/.env.example` are gone.
      `VITE_LOG_LEVEL` and `LOG_LEVEL` are documented.
- [x] Empty values (`KEY=`) count as unset in `Env.server()` and `Env.client()`, and the
      logger falls back to `info` for an empty level.
- [x] `seed` runs `tsx src/seed.ts`, and `tsx` is a db dev dependency.
- [x] Local development mode was half gone: the web app faked a signed-in user, but the server
      side was removed in the Lucia move, so signed-in calls failed. It's now a real sign-in:
      "Sign in locally" calls `/login/local`, which creates a session for `local@example.com`.
      The route only exists with `NODE_ENV=development`, `LOCAL_DEVELOPMENT=true`, and a
      database on localhost. `VITE_LOCAL_DEVELOPMENT=true` shows the button. The fake state
      and the early return that left the app on "Loading..." are gone.
- [x] `turbo.json`: `typecheck` depends on `db:generate`, outputs are `dist/**`, `build`
      hashes `.env*`, and `dev` is `persistent`.
- [x] `vite.config.ts`: port 3005 with `strictPort` (the script no longer passes `--port`),
      no `host: "0.0.0.0"`, and no external for the missing `globals.css`.
- [x] `.env.*` is ignored, except `.env.example`.
- [x] README: copy the three `.env.example` files, then `pnpm db:reset` and `pnpm dev`.
- [x] `pnpm typecheck` passes for all 8 packages. `packages/scripts/migrate-to-bucket.ts`
      still called `savePresignedImageFiles`, renamed in step 5; it's a finished one-off
      migration, so it gets a `@ts-ignore` like the rest of the file.
- [x] Tested locally (Oct 26): `db:full-reset` on a scratch database applies all 17
      migrations and runs the seed. An API started from `.env.example` starts, and
      `/login/local` redirects with a session; it's 404 with `LOCAL_DEVELOPMENT=false`,
      `NODE_ENV=production`, a remote `DATABASE_URL`, or an empty `LOCAL_DEVELOPMENT=`.
      In Chrome: "Sign in locally" signs in, `getCollection` works, and signing out works.
      The web build passes.

## 9. Deployment

**Old Dokku files.** `Procfile` runs `dist/http-server.cjs` and `dist/ws-server.cjs`, but
tsup only builds `dist/server.cjs`, and `ws-server.ts` never calls `listen`. The nginx `/ws`
upstream falls back to a 502. These files are left over from before the move to one process
on Coolify.

**`Dockerfile.web` can't build.** It copies `apps/web/nginx.conf`, which doesn't exist, passes
no `VITE_*` build args, and uses Node 18. The web app is on Vercel anyway.

**`Dockerfile.api`:**

- It runs as root.
- It ships every dev dependency (`--prod=false`), and the workspace symlinks point nowhere.
- It uses `node:20-alpine3.17`, which is end-of-life, and installs the latest pnpm and turbo
  instead of the repo's versions. `turbo prune --scope` is deprecated.
- `.dockerignore` only excludes `node_modules`, so `.git` and local `.env` files are sent to
  the build.
- Migrations never run on deploy, and `dts: true` in tsup builds type files for an app.

**WebSockets have no keep-alive**, so proxies can drop idle collaboration connections.

**Fix**

- [x] Deleted `Procfile`, `nginx.conf.sigil`, `scripts/deploy.sh`, `scripts/logs.sh`,
      `apps/api/src/http-server.ts`, `apps/api/src/ws-server.ts`, the `deploy:api` and
      `logs:api` scripts, and `docker/Dockerfile.web`.
- [x] `Dockerfile.api`: Node 24 (also in `.nvmrc`), pnpm from `packageManager` through
      corepack, turbo pinned with `TURBO_VERSION`, and `turbo prune api --docker`. The image
      only has `pnpm --filter api deploy --prod` (isolated layout, since hoisted deploys come
      out empty), the bundle, and the Prisma schema and migrations. It runs as `node` with
      `NODE_ENV=production`.
- [x] The API's runtime packages are its `dependencies`: `@prisma/client` and `prisma` pinned
      to 5.15.1, `pino`, and `pino-pretty`. `@excalidraw/excalidraw` is only used for types,
      so it's a dev dependency. The repo now has one Prisma version; the Lucia adapter used
      to pull in `@prisma/client` 5.22.0.
- [x] `.dockerignore` leaves out `.git`, `.env` files (except `.env.example`), `dist`, and
      `.turbo`.
- [x] `prisma migrate deploy` runs before the API starts, then `exec` makes Node PID 1 so it
      gets SIGTERM. `HEALTHCHECK` on `/health`.
- [x] `dts: false` in `apps/api/tsup.config.ts`.
- [x] Server `keepAlive` pings every 30 s (Cloudflare closes idle WebSockets after 100 s).
      The client WebSocket is lazy: it connects for a saved drawing and closes 10 s after
      the last subscription.
- [x] Tested the image locally (Oct 27) against Docker Postgres and S3: 17 migrations on a
      fresh database, healthy in about 8 s, Node as PID 1 running as `node`, `/login/local`
      404, two WebSocket clients collaborate, a ping after 30 s, `docker stop` saves open
      drawings in 1 s, and a restart has no pending migrations. The firewall needs a local
      copy of the Dockerfile with the corporate CA added; the repo's Dockerfile is unchanged.
- [x] Tested the lazy WebSocket in Chrome (Oct 27, step 10): none on `/`, one on a drawing,
      closed about 10 s after leaving it.
- [ ] After deploying: check that Coolify builds with `docker/Dockerfile.api` from the repo
      root, the container turns healthy, migrations ran, and collaboration stays connected
      for a few idle minutes behind Cloudflare.

## 10. Performance

**Collaborating re-renders everything on every mouse move.**
`use-pointer-collaboration.tsx` sets state on every pointer move, and the two `useMutation`
hooks re-render `Draw` on every status change. `draw.tsx` passes new `renderMenu()` and
`renderSidebar()` children each time, which breaks Excalidraw's `memo`, so Excalidraw
re-renders and calls `onChange`. Each `onChange` deep-compares and `structuredClone`s the whole
scene in `DrawingUtil.getChanges`, even when nothing changed. Each remote pointer calls
`updateScene` with all elements.

**localStorage is parsed on every render.** `useLocalStorage` from `@uidotdev/usehooks`
parses JSON on every render, and offline mode stringifies the whole scene on every change.

**Export.** `export-modal.tsx` depends on `exportToCanvas`, which is new on every render, so it
re-runs html2canvas at 3x for each code block while the modal is open. `use-export.ts` mutates
the live `appState` and calls `addFiles` with a new random id per code block per export. The
SVG object URL is never revoked.

**Bundle.** The code editor imports every Prism language, `html2canvas` loads up front, and
nothing is lazy-loaded. `index.html` blocks rendering on ten Open Sans weights that aren't
used. `lucide-react` ships twice (0.368 and 0.279).

**Fix**

- [x] The pointer is kept in a ref and sent at most every 30 ms through
      `utils.client.collaboration.updateCollaborator.mutate`, only while someone else is on the
      drawing. One update on joining tells the server you're there, and your position is sent
      when someone joins. `updateBoard` already used `utils.client` (step 2).
- [x] Pointer updates pass only `collaborators` to `updateScene`, as a new `Map`, and skip
      unchanged lists. The server only sends a subscriber the others' list when it changed, so
      your own moves no longer come back to you.
- [x] Everything passed to Excalidraw is stable: the menu, sidebar, and buttons are memoised
      elements, and callbacks use `useLatestCallback`. This also fixes stale dependency
      arrays in `useMenu`.
- [x] `onChange` returns early when `getSceneVersion` and the app state it reads are
      unchanged, diffs the elements only when the version changed, and only clones when
      something changed. The selected-element visuals re-run when the meta key or a dialog
      changes, as those used to rely on the extra Excalidraw renders (otherwise the "Tab"
      dialog showed in the top-left corner).
- [x] The offline drawing and the library are read from localStorage once. The drawing is
      saved 500 ms after changes, and on `pagehide` and unmount.
- [x] Export: the preview depends on `[useDarkMode, exportBackground]`, `appState` is copied,
      code block images are passed as extra files instead of `addFiles`, and the SVG URL is
      revoked.
- [x] Lazy: the export dialog, the code editor (only for drawings with code blocks), and
      `html2canvas`. The editor uses the `nohighlight` entry with our 27 Prism languages;
      C#, C++, F#, and Objective-C now highlight too.
- [x] Removed the Open Sans link and font family, and `ui` uses `lucide-react` 0.368.0.
- [x] Measured on a production build with the CPU 4x slower (Oct 27), with a test drawing of
      300 shapes and 2 code blocks, and a bot as the remote collaborator:

      | Main thread busy                       | Before         | After            |
      | -------------------------------------- | -------------- | ---------------- |
      | Remote cursor moving (30/s)            | 32%            | 8% (idle is 7%)  |
      | Own mouse, alone on a drawing          | 100%, 54 fps   | 12%, 60 fps      |
      | Own mouse, with a collaborator         | 100%, 44 fps   | 19%, 60 fps      |
      | Offline drawing, dragging a shape      | 74%, 47 fps    | 20%, 60 fps      |
      | Offline drawing, mouse moves           | 31%            | 11%              |
      | Export dialog, first 6 s               | 98%, 4 fps     | 60%, 28 fps      |

      Other changes: 6,120 localStorage reads per 8 s of mouse moves became 0, 60 writes
      (7.2 MB) per drag became 1 (120 KB), and no cursor messages are sent when alone (203
      before). The export adds no files to the drawing (4 before) and is idle after the
      preview. The main bundle went from 2,899 KB (901 KB gzipped) to 1,871 KB (559 KB). On
      Fast 4G, first paint went from 2.17 s to 1.25 s, the app was ready at 1.5 s instead of
      2.43 s, and the Google Fonts request is gone.
- [x] Checked in Chrome: board changes and cursors both ways, the lazy WebSocket (none on
      `/`, one on a drawing, closed about 10 s after leaving, which was open from step 9), sign
      in and out, save to collection, the sidebar, theme toggle, create copy, offline mode,
      the export preview, toggle, PNG, and SVG, code highlighting, the element dialog
      position, and the code block language menu.
- [x] **10b**, Oct 27: a 2,000-shape drawing and two untested cases, panning and a
      collaborator dragging, showed two more costs:
    - Every change deep-compared and cloned the whole scene into React state
      (`DrawingUtil.getChanges`), which re-rendered `Draw`. That took 3.2 of 6 s while someone
      dragged on the 2,000-shape drawing. The state is gone: the offline drawing is saved
      from the scene when its version differs from the last save (so a change made in the
      same render as leaving is saved too), and images are checked when the elements
      change.
    - Code block positions were state in `Draw`, so every scroll re-rendered it. They're in a
      store per drawing, read by their own component.

      | Main thread busy (CPU 4x slower)  | 300 shapes | 2,000 shapes                  |
      | --------------------------------- | ---------- | ----------------------------- |
      | Someone else drags a shape        | 25% → 18%  | 100%, 19 fps → 55%, 60 fps    |
      | You drag a shape (shared drawing) | 17% → 11%  | 80–90%, ~40 fps → 34%, 60 fps |
      | You drag a shape (offline)        | 20% → 13%  |                               |
      | Panning                           | 35% → 32%  | 100%, 60 fps (Excalidraw)     |

      Panning at 2,000 shapes is Excalidraw's own drawing; it's at 100% without our
      `onChange` too. Checked in Chrome: offline saves (after a drag, a change right before
      leaving or closing, nothing written on load), offline images saved, loaded after a
      reload, and removed when deleted, board changes both ways, typing in a code block
      syncs, and code blocks follow panning and show their language menu. A separate chunk
      for Excalidraw and React was tried and dropped: the page went blank (`forwardRef` of
      undefined, CommonJS load order).

## 11. Smaller UI bugs

- [x] **Shortcuts while typing:** `use-keyboard.ts` doesn't check `event.target`. Tab, ⌘+arrows,
      ⌘+Enter, and `+` fire inside the code editor and the rename field. Return early for
      inputs, textareas, and `contentEditable`, and require no modifiers for `+`. Shortcuts
      only check `metaKey`, so they don't work with Ctrl on Windows or Linux.
      Fixed: shortcuts are skipped in inputs, textareas, selects, and `contentEditable`;
      `+` needs no ⌘, Ctrl, or Alt (Shift is fine); ⌘ on macOS and Ctrl elsewhere.
- [x] **Stuck ⌘ key:** if the window loses focus while ⌘ is held, `keyup` never arrives and
      the shadow elements stay. Reset on `window` `blur`. Fixed: the key state resets and an
      unfinished shadow is removed.
- [x] **Silent save errors:** `use-drawing.ts` calls `handleError` without `toast: true`.
      Share in `use-menu.tsx` copies `/draw/undefined` and says "Link copied" when the save
      fails. "New drawing created" also shows before checking the result. Return early on
      failure, and await and catch the clipboard write. Fixed: a failed save toasts "Could
      not save the drawing" once and stays put. The clipboard write is caught but not
      awaited, as it can wait for focus; it toasts when it's done.
- [x] **Clicks become drags:** `use-drag.ts` registers handlers that hold the previous
      `startPosition`, so the first pixel of movement starts a drag. Listeners are added twice
      and removed with the wrong references. Use refs and stable handlers. Fixed. A started
      drag finishes even after the extend buttons unmount, which they do as soon as the arrow
      is dragged out. The dragged arrow's id is a ref, cleared when the drag ends.
- [x] **Add-element search:** it searches the already filtered list, so shapes don't come back
      after backspace. Keyboard navigation goes through 10 items while only 5 are shown.
      Search `DEFAULT_SHAPES`, navigate only visible items, and handle 0 items in
      `use-keyboard-navigation.ts`. Fixed: all six shapes are searched (Model wasn't in the
      default five), and navigation and Enter use the five shown items.
- [x] **Loading never ends:** if the board never arrives, or arrives before `excalidrawApi` is
      set, the overlay stays forever. Enable the subscription only when the API is ready, and
      add a timeout. The subscription part was done in step 1. After 20 s it toasts and goes
      to the offline drawing, and leaving a drawing clears the overlay.
- [x] **System theme:** `draw.tsx` maps `system` to dark, and the first `onChange` saves
      `dark`. The theme provider also doesn't listen for OS theme changes. Fixed: the
      provider has a `resolvedTheme` that follows the OS, and the theme is only saved when
      it's toggled in Excalidraw.
- [x] **Drawing card:** clicking the edit icon also opens the drawing, and blur keeps the
      unsaved name on screen. Fixed, and clicks in the rename field don't open it either.
- [x] **Double toast:** `use-error.ts` is missing a `return` after the custom message toast.
- [x] **Leaks:** `waitForElement` polls forever when the element never appears, the help menu
      adds its listener twice, and the `ResizeObserver` in `native-toolbar.ts` is never
      disconnected. The toolbar button can't close the add-element menu because it reads a
      stale `showAddElement`. Fixed: the help header is hidden with CSS, so
      `waitForElement` and the help button code are gone. The observer was handled in step
      1 (only the latest one lives). The toolbar button reads the store when clicked.
- [x] **Smart copy dialog:** `use-smart-copy-key-dialog.ts` doesn't multiply `height` by zoom.
- [x] **Avatars:** anonymous cursors use a `robohash.org` avatar (set by the server since step
      4, from the connection id), so every browser loads it from a third party. Consider a
      local avatar. Fixed: anonymous users get no avatar URL, so Excalidraw shows their
      initials on a colour.
- [x] Tested in Chrome (Oct 27): every item above, plus a regression check of the extend
      button drags against the old code, Share and New drawing with a failing save, the
      loading timeout with a WebSocket that never connects, and the theme with the OS
      emulated as dark and then light.

## 12. Dependencies

- [x] Update Express (4.19.2 has CVEs, as do `path-to-regexp` 0.1.7 and `body-parser` 1.20.2)
      and `cookie` to `^0.7`. Now Express 4.22.3 and cookie 0.7.2. Newer types showed that
      the API listened for `error` on the Express app, which never emits it; it's on the
      HTTP server now.
- [x] Update Vite from 4.5.3 (dev server CVEs). Now Vite 8 and plugin-react 6. The CommonJS
      and tsconfig paths plugins are gone (Vite handles both).
- [x] Move `@trpc/*` from `11.0.0-rc.417` to stable v11, and update `superjson`. Now 11.19
      and superjson 2.
- [x] Use one Node LTS in `.nvmrc`, the Dockerfile, and `engines`. Move from pnpm 8, which is
      end-of-life. Node 24 everywhere, pnpm 10.34.9. pnpm 10 only runs allowed install
      scripts (`onlyBuiltDependencies`), and the Dockerfile uses `pnpm deploy --legacy`.
      Turbo 2.11. `hoks` (git hooks) was removed, as it failed without git.
- [x] Fix peer mismatches: `@lucia-auth/adapter-prisma` pulls in `@prisma/client@5.22.0` next
      to 5.15.1. (The `react-dom@19` next to React 18 in `ui` was fixed by the lockfile update
      in step 2.) Prisma is 5.22.0 everywhere, `@types/node` 24, `tsx` 4. Lucia, its adapter,
      `arctic`, and `oslo` are deprecated upstream; replacing them is separate work.
- [x] Update `@excalidraw/excalidraw` from 0.17.6. Expect the DOM injection in
      `models/native/*` and `use-code-block-element.tsx` to break, since it relies on
      Excalidraw's internal class names. Now 0.18.1, and the DOM injection still works.
      - Renamed state: `draggingElement` is `newElement` (and `selectionElement` for the
        selection box), `editingElement` is `editingTextElement`, `commitToHistory` is
        `captureUpdate`. The CSS is imported, and the fonts are served from the app instead
        of Excalidraw's CDN (copied in by a Vite plugin).
      - Excalidraw now has ⌘/Ctrl+arrow itself (flowcharts), so both versions added a shape.
        Ours runs in the capture phase and stops the event. ⌘+arrow no longer moves the
        selection, so the code that moved it back is gone.
      - Elements get a fractional `index`. The first client to open an older drawing adds
        it and syncs every element once.
- [x] Remove unused packages: `jwt-decode`, `change-case`, `npm-run-all`, `@axiomhq/pino`,
      `vitest` in api, `api` in web, and `@excalidraw/excalidraw` as a runtime dependency of
      api and common. (`utils/token.ts` went with `jwt-decode`; common keeps Excalidraw as a
      dev dependency for its types.)
- [x] Fix ESLint plugin versions: `@tanstack/eslint-plugin-query@^4` with React Query v5, and
      `eslint-plugin-react-hooks@^4` with ESLint 9. Neither was used: linting goes through
      `@banjoanton/eslint-config`, so web's ESLint plugins were removed.
- [x] Tested (Oct 27): typecheck, tests, lint, the API Docker image (migrations, tRPC), the
      Vite dev server, and in Chrome: loading, sync both ways, local sign-in and the
      collection, image upload, export, add-element, every shortcut, the extend buttons, the
      context menu, and theme. Remote drag at 2,000 shapes costs the same as before.

## 13. Cleanup, CI, and tests

- [x] **CI:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, typecheck,
      lint, tests, and build on pushes to `main` and on pull requests, in one job of about a
      minute. The migration tests (Docker) run in `migrations.yml`, only when `packages/db`
      changes. Dependabot was tried and removed again; no automatic dependency updates for
      now.
- [x] **Tests:** a root `pnpm test` runs the vitest suites in `common` and `server` through
      Turborepo.
- [x] **Lint:** a root `pnpm lint` lints the whole repository with the shared config, in place
      of `lint:all`, which only reached `apps/web`. Fixed its one error (`db/src/ensure.ts`)
      and a few unused imports.
- [x] **Dead code:** removed `config/site.ts`, `lib/utils.ts`, `DrawingUtil.isOnlyMouseChange`,
      `BucketService.listAllBuckets`/`listAllFiles` with their models, `BucketKey.parseString`,
      the unused `ui` components (`Animated`, `Dropdown`, `DropdownRow`, `EditableLabel`,
      `Card`, `Dialog`, `Switch`, `Label`, `RadioGroup`), `apps/web/vercel.json`, and
      `packages/scripts` (the finished move of images to the bucket). From `knip`: exports
      used only in their own file, and the dependencies nothing imports (web: Radix, cva,
      clsx, framer-motion, tailwind-merge, tailwindcss-animate, which `ui` has; `ui`: the
      removed components' packages; `common`: dotenv; `server`: `@trpc/client`; root: zx).
      `debouncedSaveDrawing`, `runtime.ts`, and `apps/api/src/utils.ts` were already gone.
- [x] **Naming:** `SmartCopyKeyDialog` and `ChangeElementKeyDialog` are in files of their own
      names.
- [x] **Imports:** `drawing-emitter.ts` already imports `common`.
- [x] **Logger:** production logs plain JSON lines, and `pino-pretty` only runs when
      developing. Extra arguments go under `args` instead of `"0"`, `"1"` keys, and a logged
      object's fields are no longer overwritten by empty request fields (`userId`).
- [x] **Small fixes:** `apps/api` has no `main` and a `start` script (`node dist/server.cjs`)
      in place of the broken `run`; the root has no `main`. `scripts/db.mjs` checks that the
      database host is local, instead of looking for "localhost" anywhere in the URL.
      `.prettierignore` lists `pnpm-lock.yaml`.
- [x] **License:** MIT everywhere, with a `LICENSE` file and a section in the README.
- [x] Tested (Oct 28): the CI steps in a clean checkout without `.env` files (install, type
      check, lint with 0 errors, tests, build, and the 16 migration tests), `actionlint` on the
      workflow, the API's Docker image starting healthy with JSON logs, dev logs still pretty,
      and the app's menus, sidebar, and ⋯ menus without console errors.

## 14. Code blocks and export

- [x] **Code blocks:** they were HTML editors laid over rectangles, moved after every change.
      They trailed when panning, sat on top of everything, scrolled the page when focused,
      and needed `html2canvas` screenshots to export. Now a code block is an Excalidraw
      image of the highlighted code (SVG), with the code, language, and font size on the
      element.
      - Layering, undo, copy, export, and collaboration work like for any element. The
        image follows the canvas theme: it's light, and dark mode inverts it.
      - Images aren't uploaded: every browser makes them from the code. The file id is a
        hash of the code, language, and font size.
      - Double-click or Enter opens an editor over the block, and a new block opens it
        right away. Collaborators see the code 200 ms after typing stops, and the whole
        edit is one undo step. Escape or clicking away closes it.
      - Resizing scales the code, and edits keep that scale.
      - Old code blocks are converted to images when a drawing loads.
- [x] **Export:** the export modal, the context menu override, and `html2canvas` are gone.
      The menu opens Excalidraw's own export dialog, which has a preview, scale, dark mode,
      only selected, and embed scene.
- [x] Tested (Oct 27): conversion of old blocks (offline and shared), editing, undo and
      redo, Enter and double-click, the language and font size menu with a resized block,
      dark mode, live sync between two tabs, no image uploads or browser storage for code
      blocks, the export dialog, add-element, Tab to change a shape, smart copy, and a
      reload.

## 15. Features dialog

- [x] A dialog with what BanjoDraw adds to Excalidraw, in
      `features/features-intro/models/features.ts`. Each feature has a fixed id, and the ids a
      browser has seen are saved in localStorage (`banjo-seen-features`).
      - First visit: "Welcome to BanjoDraw" with every feature, on the start page only. Opening
        a shared link doesn't show it, as that visitor came for the drawing.
      - A feature added later shows on its own as "What's new", on any page.
      - "Features" in the menu shows them all.
      - The ⌘/Ctrl shown follows the platform, also in the smart copy hint.
- [x] Bento design: a grid with the first feature as the big card and the second wide. One to
      three features (What's new) sit side by side with their full description. Each feature
      has a hand-drawn illustration, drawn with rough.js (what Excalidraw draws with) in
      `illustrations.ts`, and dark mode uses Excalidraw's filter. Bricolage Grotesque and
      Hanken Grotesk are self-hosted with Fontsource. The dialog, its fonts, and rough.js load
      only when it opens.
- [x] Tested (Oct 27): first visit, "Start drawing", "Got it", and Escape marking features as
      seen, no dialog after a reload, two new features as What's new, no welcome on a first
      visit through a shared link, the menu item, light and dark, and a narrow window.

## 16. Collection folders and finding a drawing

- [x] Folders in the collection sidebar, chosen from five mockups (Explorer). Folders nest, have
      a color, and show how many drawings they hold. Drawings can be pinned to the top.
      Drawings by others that aren't in a folder show under "Shared with me", yours under
      "Unsorted". The sidebar has a search, a ⋯ menu and right-click on every row (open in a new
      tab, rename, pin, copy link, move to, remove with undo), drag and drop for drawings and
      folders, F2 to rename, and "New drawing" at the bottom. A pinned drawing shows in both
      places; the open drawing is highlighted in the row it was opened from, or in its folder.
- [x] Database: `CollectionEntry` replaces the implicit `_Collection` table (folder and pinned
      per user and drawing), plus a `Folder` table. Saved drawings are copied over, unsorted.
      Deleting a folder deletes its sub-folders and moves their drawings to unsorted. Migration
      tests share a Docker helper (`packages/db/scripts/postgres.mjs`).
- [x] API: a `collection` router replaces `draw.getCollection`, `saveToCollection`, and
      `deleteFromCollection`. It checks that folders belong to the user and refuses to move a
      folder into itself. Deploy the API before the web app.
- [x] ⌘O / Ctrl+O, or "Find a drawing" in the menu, opens a search over the collection, in
      place of Excalidraw's "open file". Arrows and Enter open a drawing (⌘Enter in a new
      tab), Tab searches inside a folder, and the selected drawing shows a preview, drawn from
      the saved drawing with its code blocks. No match offers a new drawing with that name.
- [x] Both are in the features dialog as "What's new". The full dialog has five columns, so all
      ten features fit in three rows, and the last cards widen to fill its last row.
- [x] The features dialog's header is the logo's amber, with the logo and its stroke, instead
      of a gradient (chosen from four mockups). Cards get an amber outline on hover. On a
      narrow window the first card is tall enough for its illustration again.
- [x] The Share button at the top right did nothing. It copies the drawing's link now; on the
      start page it saves the drawing first, like "Share drawing" in the menu.
- [x] Tested (Oct 27): moving with the menu and by dragging, dropping a folder into its own
      sub-folder (refused), a new folder, renaming with F2, renaming the open drawing (shown
      both pinned and in its folder), search, deleting a folder with
      drawings, removing and undo, pinning, the palette's keys and preview, a new drawing from
      the palette, light and dark, a narrow window, and the API refusing unknown folders,
      loops, blank names, and unknown colors.

## 17. Adding shapes and icons

- [x] The + button, the + key, and now ⌘K / Ctrl+K open a palette for adding things, chosen
      from five mockups (Spotlight), in place of the small box with five results. Chips pick
      everything, shapes, blocks, or icons, and in icons a set. Enter on a set, or on the
      "+108" tile at the end of a preview, opens it, down to a set's categories (Emojis by
      Smileys, Animals, and so on); Escape or Backspace goes back to where it was opened, on the
      same row. Tab and Shift+Tab move like the arrows. Icons show in grids, shapes and blocks as rows with a small sketch. Search
      also finds them by tags, so "database" finds Model. "Recently used" is kept between
      visits.
- [x] Nine icon sets: Logos, Tech stack (skill-icons), Files (vscode-icons), Emojis, Flags,
      Round flags, General (Carbon), Outline (Tabler), and Colorful (Fluent). Sets with the
      same icon in sizes or light and dark show one of each.
- [x] ⌘K adds at the mouse, the button in the middle of the screen (now right when zoomed).
      Shift+Enter adds and keeps the palette open, each next one beside the last. Icons keep
      their shape instead of being squeezed into a square. ⌘K was Excalidraw's "Add link",
      which is still in the element's actions.
- [x] Icons are loaded in batches of up to 80 per request, instead of one request per icon,
      and fall back to Iconify's other hosts when one fails or limits requests. Whole sets
      show a part at a time as you scroll. Flags are searched by country name in the browser,
      as Iconify only knows their codes ("sweden" found nothing).
- [x] Tested (Oct 28): the button, + and ⌘K, ⌘K again to close, every chip, opening the
      icons, a set, a category and a "+108" tile, Escape and Backspace back onto the same row
      (also with a search, and three levels deep), Tab and Shift+Tab,
      search in all and in a set, flags by name, Shift+Enter three times, a model in the
      middle, a code block at the mouse opening its editor, tall and wide logos staying in
      their tiles, scrolling through all 2,043 logos, light and dark, and a narrow window.

## 18. Arrows and undo

- [x] After ⌘/Ctrl+arrow, or a click or drag from the extend buttons, undo only changed the
      selection and left the new shape and arrow. Undo only tracks elements it saw being
      added, and the preview was added outside it and then turned into the real thing, while
      the source shape was changed in place. The preview is now unbound and left out of
      undo, and confirming it adds a new shape and arrow and updates the source as a copy.
- [x] On a shared drawing, the first undo after opening it deleted the whole drawing, for
      everyone, as loading it counted as part of your first change. Undo also took back
      collaborators' changes. Both now update the scene without being undoable.
- [x] Arrows made by BanjoDraw didn't start at 0,0, which Excalidraw logs as "Linear element
      is not normalized" (often on undo and redo). Their bindings aim at the center now
      (focus 0), so they don't jump the first time a shape moves.
- [x] Dragging an arrow out of an extend button listed it twice on the source shape, and
      kept the preview arrow's id there too. Bound elements are only added once now.
- [x] The arrow dragged out of an extend button didn't show until it was dropped. Excalidraw
      draws the element being drawn from `newElement` and leaves it out of the scene, and
      that kept the empty arrow from the start of the drag. It's updated with each move now,
      which also keeps the highlight on the shape it will connect to.
- [x] Dragging an arrow out of an extend button reset the style picked for the next things
      drawn (stroke color, style, opacity, roundness, and so on) to Excalidraw's defaults,
      and changed Excalidraw's state in place. Only the tool changes now.
- [x] A shape added with ⌘/Ctrl+arrow or an extend button copies the type (rectangle,
      ellipse, or diamond) and look (colors, fill, stroke, sloppiness, edges, opacity) of the
      shape it extends. The arrow keeps the default look. The preview shows it too, dashed
      and faded. From anything else, like an image, it's still a plain rectangle.
- [x] Changing a shape's type (Tab) gave it a new id, so arrows came loose from it and its
      label lost its shape. On a shared drawing the old shape came back after a reload, as
      it was dropped instead of deleted. Between rectangle, ellipse, and diamond only the
      type changes now; to a code block or model, the old shape and label are deleted and
      arrows unbound.
- [x] Smart copy (⌘/Ctrl+Enter) of connected shapes left the copied arrows bound to the
      originals. Bindings and labels between copied elements now point to the copies, and
      bindings to anything else are dropped.
- [x] Tested (Oct 28): each of these before and after the fix, in the offline drawing and a
      shared one with two tabs: undo and redo of ⌘+arrow and of an arrow dragged from an
      extend button down to an empty drawing and back, changing direction before letting go,
      cancelling, moving the shapes afterwards, smart copy with a label and with arrows, type
      changes with an arrow and a label, and reloading after a type change. No console
      errors.

## 19. Changing a shape

- [x] In the picker that Tab opens on a selected shape, Tab moved the browser's focus and a
      separate highlight, so they drifted apart, and after the last shape it went on to
      Excalidraw's menu and toolbar. It's now a small palette beside the shape, chosen from
      five mockups: type to filter (also by tags, so "database" finds Model), Tab or the
      arrows to move round and round, Enter or a click to change, Escape or clicking away to
      close. Shapes and blocks are listed apart with the add palette's sketches, the current
      type is marked, and it starts on the next one, so Tab, Enter swaps to it. It opens on
      the left when there's no room on the right.
- [x] The hint above a selected shape says what Tab does: "Tab · Change shape".
- [x] Changing a shape to a code block or a model dropped its arrows. They're moved to the
      new block's edge and bound to it now (to the model's box), and the block is centered
      where the shape was, as it has its own size.
- [x] Tested (Oct 28): Tab and Shift+Tab around the list both ways, the arrows, filtering by
      name and tag, nothing matching, Enter, clicking a row, Escape, clicking the canvas,
      opening from the hint, a shape at the right edge, a code block (to a model), undo, and
      light and dark. Shapes with arrows in and out changed to a code block and a model,
      undone, and moved afterwards. No console errors.
