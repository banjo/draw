import { collaborationRouter } from "./router/collaboration";
import { drawRouter } from "./router/draw";
import { fileRouter } from "./router/file";
import { imageRouter } from "./router/image";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
    draw: drawRouter,
    image: imageRouter,
    file: fileRouter,
    collaboration: collaborationRouter,
});

export type AppRouter = typeof appRouter;
