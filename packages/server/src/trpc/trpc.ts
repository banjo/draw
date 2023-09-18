/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import superjson from "superjson";
import { createLogger } from "utils";
import { ZodError } from "zod";

const logger = createLogger("auth");

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API
 *
 * These allow you to access things like the database, the session, etc, when
 * processing a request
 *
 */

/**
 * This is the actual context you'll use in your router. It will be used to
 * process every request that goes through your tRPC endpoint
 * @link https://trpc.io/docs/context
 */
export const createTRPCContext = async ({ req, res }: trpcExpress.CreateExpressContextOptions) => {
    return { req, res }
    // const authHeader = req?.headers.authorization;
    // const createResponse = (userId?: number) => {
    //     return {
    //         req,
    //         res,
    //         userId,
    //     };
    // };

    // if (!authHeader) {
    //     logger.info("No auth header");
    //     return createResponse();
    // }

    // if (!authHeader?.startsWith("Bearer ")) {
    //     logger.info("No bearer token");
    //     return createResponse();
    // }

    // const idToken = authHeader.split("Bearer ")[1];

    // if (!idToken) {
    //     logger.info("No id token");
    //     return createResponse();
    // }

    // let decodedToken: DecodedIdToken;
    // try {
    //     decodedToken = await auth.verifyIdToken(idToken);
    // } catch (error) {
    //     console.log(error);
    //     return createResponse();
    // }

    // const userIdResponse = await UserRepository.getIdByExternalId(decodedToken.uid);

    // if (!userIdResponse.success) {
    //     logger.info("No user id in database, creating user");

    //     const externalId = decodedToken.uid;
    //     const email = decodedToken.email;
    //     const name = decodedToken.name;

    //     if (!externalId || !email || !name) {
    //         logger.error("No externalId, email or name in decoded token");
    //         return new Response("Unauthorized", { status: 401 });
    //     }

    //     const user = await UserRepository.createUser({
    //         externalId,
    //         email,
    //         name,
    //     });

    //     if (!user.success) {
    //         logger.error("Could not create user");
    //         return new Response("Unauthorized", { status: 401 });
    //     }

    //     logger.info("Created user with id: ", user.data.id);

    //     return createResponse(user.data.id);
    // }

    // return createResponse(userIdResponse.data);
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
            },
        };
    },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure;

/**
 * Reusable middleware that enforces users are logged in before running the
 * procedure
 */
// const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
//     if (!ctx.userId) {
    
//         throw new TRPCError({ code: "UNAUTHORIZED" });
//     }
//     return next({
//         ctx: {
//             // infers the `session` as non-nullable
//             session: { userId: ctx.userId },
//         },
//     });
// });

/**
 * Protected (authed) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use
 * this. It verifies the session is valid and guarantees ctx.session.user is not
 * null
 *
 * @see https://trpc.io/docs/procedures
 */
// export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
