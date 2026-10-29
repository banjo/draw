import { collaborationRouter } from "./router/collaboration";
import { collectionRouter } from "./router/collection";
import { drawRouter } from "./router/draw";
import { fileRouter } from "./router/file";
import { linkRouter } from "./router/link";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
    draw: drawRouter,
    collection: collectionRouter,
    file: fileRouter,
    collaboration: collaborationRouter,
    link: linkRouter,
});

export type AppRouter = typeof appRouter;
