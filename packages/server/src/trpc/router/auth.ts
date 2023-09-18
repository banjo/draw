import { createTRPCRouter, protectedProcedure } from "../trpc";

export const authRouter = createTRPCRouter({
    getSession: protectedProcedure.query(({ ctx }) => {
        return ctx.userId;
    }),
    getSecretMessage: protectedProcedure.query(() => {
        // testing type validation of overridden next-auth Session in @acme/auth package
        return "you can see this secret message!";
    }),
});
