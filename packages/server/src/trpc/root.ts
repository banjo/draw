import { collaborationRouter } from "./router/collaboration";
import { drawRouter } from "./router/draw";
import { fileRouter } from "./router/file";
import { libraryRouter } from "./router/library";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
    draw: drawRouter,
    file: fileRouter,
    collaboration: collaborationRouter,
    library: libraryRouter,
});

export type AppRouter = typeof appRouter;
