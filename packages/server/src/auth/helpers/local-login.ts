import { Env } from "common";
import { Request, Response } from "express";
import { createContextLogger } from "../../lib/context-logger";
import { lucia } from "../../lib/lucia";
import { isLocalDevelopment } from "../../lib/runtime";
import { HttpResponse } from "../../model/http-response";
import { AuthRepository } from "../../repositories/auth-repository";

const env = Env.server();
const logger = createContextLogger("local-login");

const LOCAL_USER = { email: "local@example.com", name: "Local user" };

/** Sign in as a local user without OAuth. Only for local development. */
export const localLogin = async (_req: Request, res: Response) => {
    if (!isLocalDevelopment()) {
        return HttpResponse.notFound({ res, message: "Not found" });
    }

    const user = await AuthRepository.getOrCreateUser(LOCAL_USER);
    if (!user.success) {
        return HttpResponse.internalServerError({ res, message: "Could not sign in" });
    }

    const session = await lucia.createSession(user.data.id, {});
    logger.info({ userId: user.data.id }, "Signed in locally");

    return HttpResponse.redirect({
        res,
        url: env.CLIENT_URL,
        cookies: [lucia.createSessionCookie(session.id).serialize()],
    });
};
