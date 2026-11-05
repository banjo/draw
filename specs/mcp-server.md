# MCP Server

## Goal

Add a Model Context Protocol server to the API so Pro users can connect MCP clients (Claude Code, opencode, Codex) and let an agent list, read, create and change their drawings.

Agents work with `DiagramSpec` (`packages/common/src/model/ai.ts`), the same high-level format the AI dialog uses: nodes, edges and groups, without coordinates. The server lays it out and turns it into BanjoDraw's elements. Changes are made in small operations, not by replacing the drawing, and reach everyone who has the drawing open right away.

## Non-goals

- No separate MCP process. It runs in `apps/api`.
- No stdio transport.
- No deleting drawings through MCP.
- No raw Excalidraw elements in or out in v1. A later version can add them for what `DiagramSpec` can't express.
- No Mermaid blocks in v1. They are uploaded SVGs that need a browser to render.
- No MCP resources or prompts, tools only.
- MCP tokens don't authenticate tRPC, the WebSocket or any other route.
- No AI generation tool in v1. The agent is the AI. `generate_diagram` can come later on top of `AiService` and `withLimit`.

## Transport

Use `@modelcontextprotocol/sdk` with Streamable HTTP, mounted in `apps/api/src/lib/http.ts` at:

```text
/mcp
```

- Mounted before the Lucia cookie middleware, or skipped by it: MCP never reads cookies.
- Not behind the `CLIENT_URL` CORS rule. MCP clients aren't browsers.
- Stateless: a new server and transport per request is fine, nothing is kept between calls.
- Each request runs in `NodeContext` with a request id and the token's user id, so logs look like the rest of the API.

## Authentication

MCP uses long-lived bearer tokens:

```http
Authorization: Bearer bdmcp_<random-url-safe-token>
```

- 32 random bytes, base64url, prefixed with `bdmcp_`.
- Only the SHA-256 hash is stored. The raw token is shown once, when it's created.
- A request fails if the token is missing, unknown, revoked, or its user isn't Pro right now. Losing Pro stops existing tokens at once.
- `lastUsedAt` is updated after a successful check, at most once a minute per token.

### Prisma

In `packages/db/prisma/schema.prisma`, with a migration and a test in `packages/db/scripts/` like the existing ones:

```prisma
model McpToken {
  id         String    @id @default(uuid())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     Int
  name       String
  tokenHash  String    @unique
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

Add `mcpTokens McpToken[]` to `User`.

### Managing tokens

A new tRPC router `mcp` in `packages/server/src/trpc/router/mcp.ts`. All procedures are `protectedProcedure` and reject users who aren't Pro (`AiRepository.getPlan`).

| Procedure                    | Input                     | Output                                                              |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `mcp.listTokens` (query)     | none                      | `{ id, name, createdAt, lastUsedAt }[]`, active tokens only         |
| `mcp.createToken` (mutation) | `{ name: string(1..60) }` | `{ id, name, token, createdAt }`, the only time `token` is returned |
| `mcp.revokeToken` (mutation) | `{ id }`                  | sets `revokedAt` if the token is the user's                         |

A user can have at most 20 active tokens.

## Tools

Every tool works only on drawings the token's user owns (`Drawing.ownerId`). Others get "Drawing not found", the same as drawings that don't exist, so their slugs can't be probed.

`appUrl` in outputs is `${CLIENT_URL}/draw/${slug}`. It only opens for the owner unless the drawing is shared.

### Ids

- In everything the tools return, a node's `id` is the Excalidraw id of its main element (the shape, not its label), and a group's `id` is its frame's id. Edges get an `id` too: their arrow's id.
- In `create_diagram` and in `update_diagram`'s `add`, the agent picks its own ids, like `api` or `db`, and edges can refer to them. The output's `ids` maps each to the element id it got. Later calls use the element ids.
- In `update_diagram`, an edge or a node's `group` can refer to existing element ids and new ids from the same call.
- Element ids are made by the server (21 characters, like Excalidraw's), so they never clash with what's in the drawing.

### `list_diagrams`

The user's drawings, newest change first. Owned drawings, not just the ones in the collection.

Input: `{}`

Output:

```json
{
    "diagrams": [
        {
            "slug": "uuid",
            "name": "Checkout flow",
            "appUrl": "https://draw.banjoanton.com/draw/uuid",
            "updatedAt": "2026-11-05T12:00:00Z"
        }
    ]
}
```

`Drawing` already has `createdAt` and `updatedAt` (`@updatedAt`), so no migration is needed for them. `saveDrawingFromBoard` and `updateDrawingName` keep `updatedAt` current.

### `get_diagram`

Input: `{ "slug": "uuid" }`

Output:

```json
{
    "slug": "uuid",
    "name": "Checkout flow",
    "appUrl": "…",
    "diagram": {
        "direction": "right",
        "groups": [{ "id": "frameElementId", "label": "Backend" }],
        "nodes": [
            {
                "id": "elementId",
                "type": "shape",
                "shape": "rounded",
                "label": "API",
                "color": "blue",
                "group": "frameElementId",
                "box": { "x": 120, "y": 40, "width": 150, "height": 80 }
            }
        ],
        "edges": [
            { "id": "arrowElementId", "from": "elementId", "to": "otherElementId", "label": "SQL" }
        ]
    },
    "other": { "count": 3, "summary": "2 drawings and an image" }
}
```

- Read from the latest board, the same way as `draw.getLatestElements`: from memory if the drawing is open, else from the database. `draw.getDrawing` can be a minute old.
- `box` is where each node is, so the agent can tell what's next to what. It's read-only. Positions aren't set through MCP.
- `other` counts what `DiagramSpec` can't express: freehand drawings, images, Mermaid blocks, swimlanes, loose arrows and lines. They're never changed by MCP.

### `create_diagram`

Input:

```json
{
    "name": "Checkout flow",
    "diagram": { "direction": "right", "groups": [], "nodes": [], "edges": [] }
}
```

- `diagram` is validated with `DiagramSpec` and cleaned with `DiagramSpecUtil.clean`. What `clean` drops is listed in `warnings`.
- Laid out from scratch, like a new AI diagram.
- One transaction, like `DrawRepository.createCopy`: the drawing with its name, owned by the user, `linkAccess: "private"`, and a `CollectionEntry` so it shows in the sidebar.

Output:

```json
{
    "slug": "uuid",
    "name": "Checkout flow",
    "appUrl": "…",
    "ids": { "api": "elementId", "db": "elementId" },
    "warnings": []
}
```

### `update_diagram`

Changes part of a drawing. Anything not mentioned stays as it is, where it is.

Input:

```json
{
    "slug": "uuid",
    "name": "Checkout flow v2",
    "add": {
        "groups": [{ "id": "cache-group", "label": "Cache" }],
        "nodes": [
            {
                "id": "redis",
                "type": "shape",
                "shape": "cylinder",
                "label": "Redis",
                "group": "cache-group"
            }
        ],
        "edges": [{ "from": "apiElementId", "to": "redis", "label": "GET" }]
    },
    "update": [
        { "id": "apiElementId", "label": "API v2", "color": "green" },
        { "id": "arrowElementId", "label": "SQL", "style": "dashed" },
        { "id": "frameElementId", "label": "Services" }
    ],
    "remove": ["oldNodeElementId", "oldArrowElementId"]
}
```

Every part is optional, but there has to be at least one.

**Add**

- New nodes go next to an existing node they're connected to, or after everything, using `placeAround` from the builder: existing elements keep their positions.
- A new node can join an existing group (a frame id) or a new one. The frame grows to fit it.
- New groups are frames around their new nodes.

**Update**

- Nodes: `label` / `text`, `color`, `shape` for shapes. For blocks, the field that makes their content: `markdown`, `rows`, `code` and `language`, `url`, `title` and `chartType`. A node's `type` can't change: remove it and add a new one.
- A shape grows when its new label doesn't fit, and never shrinks.
- Edges: `label`, `style`, `heads`. Their ends can't change: remove the edge and add a new one.
- Groups: `label`.

**Remove**

- A node takes its label and the arrows bound to it with it.
- An edge takes its label with it, and comes out of the `boundElements` of both ends.
- A group's frame goes, but what's in it stays.
- Elements are marked `isDeleted`, not dropped, so an older copy in a browser can't bring them back.

**How it's applied**

- Build the change from the latest board, then send it with `drawingEmitter.update(slug, { excalidrawElements, order })`, with no `origin`, so every open browser gets it. New elements go at the end of `order`.
- Every changed element gets `version + 1`, a new `versionNonce` and `updated: Date.now()`. Otherwise the merge rule in `DeltaUpdateUtil` throws the change away.
- If someone changes the same element at the same moment, whoever has the higher version wins, as in a normal collaboration.
- Unknown ids in `update` or `remove` fail the whole call, and nothing is changed.

Output:

```json
{
    "slug": "uuid",
    "appUrl": "…",
    "ids": { "redis": "elementId", "cache-group": "frameElementId" },
    "warnings": []
}
```

### Limits

- Use the `DiagramSpec` limits for `create_diagram`, and for `add` in one call: 80 nodes, 160 edges, 20 groups.
- A drawing can't go over `MAX_ELEMENTS` (20 000).

### Tool descriptions

Each tool's description says what it does and the rules above in a few lines. The format guide in `AiService`'s system prompt (`packages/server/src/services/ai-service.ts`) moves to `packages/common` and is used by both the AI and the MCP tools, so they can't drift apart.

## Building diagrams on the server

`DiagramBuilder` (`apps/web/src/features/ai/models/diagram-builder.ts`) only runs in the browser: it uses `convertToExcalidrawElements` from `@excalidraw/excalidraw` and renders blocks with browser fonts. It moves to `packages/common` as plain TypeScript, which the web app and the server both use:

- **Elements without Excalidraw.** A small set of element factories in `common` (rectangle, ellipse, diamond, text, arrow, frame, image) that fill every field the client needs. The client calls `updateScene` without `restoreElements`, so nothing may be missing: `id`, `seed`, `version`, `versionNonce`, `updated`, `index: null`, `groupIds`, `frameId`, `boundElements`, `link`, `locked`, `roughness`, `opacity`, `strokeColor`, `strokeWidth`, `strokeStyle`, `fillStyle`, `angle`, and per type `points`, `startBinding`, `endBinding`, `fontFamily`, `lineHeight`, `containerId`, `originalText`, `autoResize`, `verticalAlign`, `textAlign`, `status`, `scale`, `crop`. Test that the elements come out of Excalidraw's `restoreElements` unchanged, so we know they're complete.
- **Labels.** Bound text for shapes and arrows, centered, with `containerId` on the text and `{ type: "text" }` in the container's `boundElements`, the way `convertToExcalidrawElements` makes them. Text is measured with `measureLabel`'s estimate (11 px a character at 20 px). Excalidraw measures it again when the drawing opens.
- **Layout.** `layOut`, `placeAround`, `placeLoose` and `drawArrow` move as they are. `dagre` becomes a dependency of `common`.
- **`hashString`.** Copy Excalidraw's (djb2, five lines) to `common`, so file ids for blocks are the same on both sides.
- **Blocks** (notes, tables, charts, code and link cards) are image elements with their content in `customData` and a `fileId` made from it. Every browser makes the image itself when it opens the drawing (`useGeneratedImages`), so the server makes no files.
    - Code blocks: `CodeBlockImage.getNaturalSize` is plain arithmetic, so it moves to `common` and gives the exact size.
    - Notes, tables, charts and link cards: their size comes from rendering. The server estimates it and sets `customData.unmeasured: true`, as it does on text and labels whose size it estimated. Code blocks get an exact size and no flag. The first browser that can edit the drawing measures these elements, sets their size (keeping the top left corner), removes the flag and bumps the version, so everyone gets the right size once.
    - Link cards: the server gets the title and icon with `LinkPreviewService`, as the AI dialog does through the API today.
- The web app's AI dialog uses the moved builder, with its block renderers passed in, so it keeps its exact sizes.

`DiagramReader` (`apps/web/src/features/ai/models/diagram-reader.ts`) moves to `common` too, for `get_diagram`. On the server it reads the whole board, not a selection, and uses element ids instead of ids made from labels. The functions it calls (`CustomDataUtil`, `getContent` of each block, `SwimlaneLayout.isSwimlane` / `isPart`, `getCommonBounds`) only read `customData` and geometry, and move with it.

## Web app

- **MCP dialog**, opened from a `MCP` row in the account menu (`features/account/components/account-menu.tsx`) and `Open MCP setup` in ⌘K. Shown to Pro users; others see it with the Pro badge and a short explanation, like the AI dialog.
    - The server URL, `${VITE_API_URL}/mcp`.
    - Tokens: the list (name, created, last used), a field to name and create one, revoke with a confirm. A new token is shown once, with a copy button and: "Copy this token now. You won't be able to see it again."
    - Tabs with config snippets for Claude Code, opencode and Codex, with the token filled in right after it was made.
    - What the tools can do, and that MCP can't delete drawings.
- **`unmeasured`** handling for text, labels and blocks, described above.
- The builder and reader are imported from `common`. The AI dialog keeps working as before.

## Errors

Tool errors are MCP tool results with `isError: true` and a short message:

- Missing, unknown or revoked token: HTTP 401 before MCP runs.
- Not Pro: HTTP 403, "MCP is part of Pro".
- "Drawing not found."
- "Invalid diagram: …", with the zod path and message.
- "Unknown id: …" for `update` and `remove`.
- "Too many elements."

Never return token hashes, stack traces or database errors.

## Implementation order

1. Move the builder, reader, `hashString` and the code block size to `common`, with element factories that don't use Excalidraw. The AI dialog uses them, and tests check the elements against `restoreElements`.
2. `unmeasured` in the web app.
3. Prisma: `McpToken`.
4. The token check and the `mcp` tRPC router.
5. `/mcp` with the four tools.
6. The MCP dialog.

## Verification

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter db test:migrations
```

Tests (Vitest, in `packages/common` and `packages/server`):

- Built elements are complete: `restoreElements` doesn't change them.
- Bound text and arrow bindings point both ways.
- `get_diagram` read back after `create_diagram` gives the same nodes, edges and groups.
- `update_diagram`: positions of untouched elements stay, versions go up, removed nodes take their arrows, unknown ids change nothing.
- Token check: unknown, revoked and non-Pro tokens fail. A user who loses Pro is refused on the next call.
- Tools only see the token user's drawings.

Checks by hand, with an MCP client such as opencode against a local API:

- Make a token in the dialog, paste the config, and list drawings.
- Create a diagram with shapes, a group, a note, a table and a code block. It shows in the sidebar, opens at `appUrl`, and the notes and tables get their right size once.
- With the drawing open in two browsers, add, change and remove nodes through MCP. Both update at once and nothing else moves.
- Revoke the token: the next call fails.
- A free account sees no way to make tokens, and an old token stops working when Pro ends.
