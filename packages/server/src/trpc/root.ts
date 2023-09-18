import { drawRouter } from "./router/draw";
import { imageRouter } from "./router/image";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
    draw: drawRouter,
    image: imageRouter,
});

export type AppRouter = typeof appRouter;
