/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { attempt, uuid, wrapAsync } from "@banjoanton/utils";
import { initTRPC, TRPCError } from "@trpc/server";
import { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { Cause } from "common";
import { auth } from "firebase-server";
import superjson from "superjson";
import { ZodError } from "zod";
import { createContextLogger } from "../lib/context-logger";
import { NodeContext } from "../lib/node-context";
import { getLocalDevelopmentId, isLocalDevelopment } from "../lib/runtime";
import { UserRepository } from "../repositories/user-repository";

const logger = createContextLogger("auth-middleware");

export const createTRPCContext = async ({
    req,
    res,
}: CreateExpressContextOptions | CreateWSSContextFnOptions) => {
    const createResponse = (userId?: number, expired = false) => ({
        req,
        res,
        userId,
        expired,
    });

    const authHeader = req?.headers.authorization;

    if (isLocalDevelopment()) {
        return createResponse(getLocalDevelopmentId());
    }

    const idToken = attempt(() => authHeader?.split("Bearer ")[1]);

    if (!idToken) {
        logger.trace("No id token");
        return createResponse();
    }

    const [decodedToken, error] = await wrapAsync(async () => await auth.verifyIdToken(idToken));

    if (error) {
        logger.error({ error }, "Error verifying token for user");
        return createResponse(undefined, true);
    }

    const userIdResponse = await UserRepository.getIdByExternalId(decodedToken.uid);

    if (!userIdResponse.success) {
        logger.info("No user id in database, creating user");

        const externalId = decodedToken.uid;
        const email = decodedToken.email;
        const name = decodedToken.name;

        if (!externalId || !email || !name) {
            logger.error("No externalId, email or name in decoded token");
            return createResponse();
        }

        const user = await UserRepository.createUser({
            externalId,
            email,
            name,
        });

        if (!user.success) {
            logger.error(`Could not create user - ${user.message}`);
            return createResponse();
        }

        NodeContext.setUserId(user.data.id);
        logger.info({ id: user.data.id }, "Successfully created user");
        return createResponse(user.data.id);
    }

    NodeContext.setUserId(userIdResponse.data);
    logger.trace({ userId: userIdResponse.data }, "Successfully authenticated user");
    return createResponse(userIdResponse.data);
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
