# BanjoDraw

**BanjoDraw** is a simple drawing board built on top of [Excalidraw](https://excalidraw.com/), adding a handful of useful features for individuals. Enjoy real-time collaboration, persistent boards, quick icon and emoji insertion, and more—all while keeping the familiar Excalidraw experience.

---

## 🚀 Demo

Try it out: [draw.banjoanton.com](https://draw.banjoanton.com)

---

## ✨ Features

- **Real-Time Collaboration**  
     Draw, edit, and brainstorm together with others instantly via WebSockets.

- **Persistent Boards**  
     Save unlimited boards and images to your account. Your work is always available.

- **Authentication & Sync**  
     Log in with GitHub or Google. Sync your favorites and boards across devices.

- **Rich Element Library**  
     Use and extend with custom elements:

  - Database models
  - Code blocks (with syntax highlighting)
  - Smart copy & extend

- **Image Support**  
     Upload, share, and manage images directly on your boards.

- **Quick Add**  
     Instantly add icons and emojis to your board with just a click.

---

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) (see `.nvmrc`)
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- [Docker](https://www.docker.com/) (for local DB)

### Common Commands

```bash
# Install dependencies
pnpm install

# Start local PostgreSQL via Docker
pnpm run db:local:run

# Reset database (danger: removes all data)
pnpm run db:reset

# Start development servers (API & Web)
pnpm run dev

# Build all apps
pnpm run build

# Preview production build (if available)
pnpm run preview
```

---

## 🛠️ Development Notes

- **Monorepo** managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/)
- **Code style**: ESLint, Prettier, Tailwind CSS
- **Backend**: Node.js, tRPC, Prisma, Lucia Auth, REST, WebSockets
- **Frontend**: React, Vite, Tailwind, tRPC, modular features

---

## 🤝 Contributing

Pull requests and issues are welcome!

---

> _BanjoDraw: Draw, collaborate, and build diagrams together — with a little extra twang!_
