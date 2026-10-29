<p align="center">
  <img src="apps/web/public/banjodraw.svg" width="96" height="96" alt="BanjoDraw logo">
</p>

<h1 align="center">BanjoDraw</h1>

<p align="center">
  A drawing board built on <a href="https://excalidraw.com">Excalidraw</a>, with collaboration, saved boards, and a few extras.
</p>

<p align="center">
  <a href="https://draw.banjoanton.com"><b>Open BanjoDraw</b></a>
</p>

## Highlights

- 🤝 Real-time collaboration: draw and brainstorm with others over WebSockets
- 💾 Persistent boards: save as many boards and images as you want to your account
- 🔐 Sign in with GitHub or Google, and your boards and favorites sync across devices
- 🧱 Custom elements: database models, code blocks with syntax highlighting, Mermaid diagrams,
  swimlanes, Markdown notes, and smart copy and extend
- 🖼️ Upload, share, and manage images right on the board
- ⚡️ Add shapes, logos, emojis, flags, and thousands of icons from one search (⌘K)
- ✏️ Everything else is plain Excalidraw, so it works the way you already know

## Getting started

Open [draw.banjoanton.com](https://draw.banjoanton.com) and start drawing.

To run it yourself, you need [Node.js](https://nodejs.org) (see `.nvmrc`),
[pnpm](https://pnpm.io), and [Docker](https://www.docker.com) for the database:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
pnpm db:reset          # Start Postgres and S3 in Docker, and create the tables.
pnpm dev               # Run the web app and the API.
```

Open [localhost:3005](http://localhost:3005) and use "Sign in locally" to sign in without
OAuth.

## Development

```bash
pnpm build        # Build all apps.
pnpm typecheck    # Type check everything.
pnpm lint         # Lint everything.
pnpm test         # Run the tests.
pnpm db:reset     # Recreate the database. This removes all data.
```

The repository is a [pnpm workspace](https://pnpm.io/workspaces) run with
[Turborepo](https://turbo.build):

- `apps/web`: React, Vite, Tailwind, and tRPC
- `apps/api`: Node.js, Express, tRPC, and WebSockets
- `packages/db`: Prisma and PostgreSQL
- `packages/server`: Auth with Lucia, and shared server code

## Contributing

Pull requests and issues are welcome. GitHub Actions type checks, lints, tests, and builds
every pull request.

## License

[MIT](LICENSE)
