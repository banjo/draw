import { collaborationRouter } from "./router/collaboration";
import { collectionRouter } from "./router/collection";
import { drawRouter } from "./router/draw";
import { fileRouter } from "./router/file";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
    draw: drawRouter,
    collection: collectionRouter,
    file: fileRouter,
    collaboration: collaborationRouter,
});

export type AppRouter = typeof appRouter;
