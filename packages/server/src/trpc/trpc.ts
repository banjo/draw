import { uuid } from "@banjoanton/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { Cause } from "common";
import superjson from "superjson";
import { ZodError } from "zod";
import { createContextLogger } from "../lib/context-logger";
import { NodeContext } from "../lib/node-context";

const logger = createContextLogger("auth-middleware");

export const createTRPCContext = async ({ req, res }: CreateExpressContextOptions) => {
    const createResponse = (userId?: number, expired = false) => ({
        req,
        res,
        userId,
        expired,
    });

    const { user } = res.locals;
    if (user) {
        NodeContext.setUserId(user.id);
    }
    return createResponse(user?.id);
};

const t = initTRPC.context<typeof createTRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        const cause = Cause.fromServerError(error);

        return {
            ...shape,
            cause,
            data: {
                ...shape.data,
                zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
        };
    },
});

export const createTRPCRouter = t.router;

const contextMiddleware = t.middleware(({ type, next, path, ctx }) => {
    const contextExists = NodeContext.exists();

    // Context already exists in HTTP request from Express
    if (contextExists) {
        return next();
    }

    return NodeContext.context.run(NodeContext.store, async () => {
        const isWS = type === "subscription" || path.includes("collaboration");
        NodeContext.setIsWS(isWS);
        NodeContext.setRequestId(uuid());

        if (ctx.userId) {
            NodeContext.setUserId(ctx.userId);
        }

        return await next();
    });
});

const enforceUserIsAuthenticated = t.middleware(({ ctx, next }) => {
    if (ctx.expired) {
        logger.error("Token expired");
        throw new TRPCError({
            code: "UNAUTHORIZED",
            cause: Cause.EXPIRED_TOKEN,
            message: "Token expired",
        });
    }

    if (!ctx.userId) {
        logger.error("No user id in context");
        throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
        ctx: {
            // infers the `session` as non-nullable
            session: { userId: ctx.userId },
        },
    });
});

export const publicProcedure = t.procedure.use(contextMiddleware);
export const protectedProcedure = t.procedure
    .use(enforceUserIsAuthenticated)
    .use(contextMiddleware);
