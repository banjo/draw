import { uuid } from "@banjoanton/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { Cause } from "common";
import { User } from "lucia";
import superjson from "superjson";
import { ZodError } from "zod";
import { createContextLogger } from "../lib/context-logger";
import { lucia } from "../lib/lucia";
import { NodeContext } from "../lib/node-context";

const logger = createContextLogger("auth-middleware");

export type TRPCContext = {
    userId?: number;
    user?: User;
    expired: boolean;
    /** Set over WebSocket only. One per connection, which is one per browser tab. */
    connectionId?: string;
};

export const createTRPCContext = async ({
    res,
}: CreateExpressContextOptions): Promise<TRPCContext> => {
    const user: User | null = res.locals.user;
    if (user) {
        NodeContext.setUserId(user.id);
    }

    return { userId: user?.id, user: user ?? undefined, expired: false };
};

/** The context of a WebSocket connection, signed in with the session cookie of the upgrade. */
export const createWSContext = async ({ req }: CreateWSSContextFnOptions): Promise<TRPCContext> => {
    const connectionId = uuid();
    const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");
    if (!sessionId) return { expired: false, connectionId };

    try {
        const { user } = await lucia.validateSession(sessionId);
        return { userId: user?.id, user: user ?? undefined, expired: false, connectionId };
    } catch (error) {
        logger.error({ error }, "Could not validate WebSocket session");
        return { expired: false, connectionId };
    }
};

const t = initTRPC.context<TRPCContext>().create({
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

    // A new context per call, so concurrent calls don't share ids in the logs
    const isWS = type === "subscription" || path.includes("collaboration");
    return NodeContext.run({ isWS, userId: ctx.userId }, async () => await next());
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
