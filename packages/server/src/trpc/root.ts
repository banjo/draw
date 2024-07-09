import { collaborationRouter } from "./router/collaboration";
import { drawRouter } from "./router/draw";
import { fileRouter } from "./router/file";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
    draw: drawRouter,
    file: fileRouter,
    collaboration: collaborationRouter,
});

export type AppRouter = typeof appRouter;
