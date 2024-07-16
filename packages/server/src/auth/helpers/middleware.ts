import { RequestHandler } from "express";
import { createContextLogger } from "../../lib/context-logger";
import { lucia } from "../../lib/lucia";

const logger = createContextLogger("oauth-core");

export const middleware: RequestHandler = async (req, res, next) => {
    logger.trace("Auth middleware initiated");
    const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");

    if (!sessionId) {
        logger.trace("No session id");
        res.locals.user = null;
        res.locals.session = null;
        return next();
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (session && session.fresh) {
        logger.trace("Updating session cookie");
        res.appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize());
    }

    if (!session) {
        logger.trace("Removing session cookie");
        res.appendHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize());
    }

    logger.trace("Successfully authenticated user");
    res.locals.session = session;
    res.locals.user = user;
    return next();
};
