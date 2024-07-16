import { Request, Response } from "express";
import { createContextLogger } from "../../lib/context-logger";
import { lucia } from "../../lib/lucia";
import { HttpResponse } from "../../model/http-response";

const logger = createContextLogger("oauth-core");

export const logout = async (req: Request, res: Response) => {
    if (!res.locals.session) {
        logger.trace("No session to sign out");
        return res.status(401).end();
    }

    await lucia.invalidateSession(res.locals.session.id);

    logger.trace("Signing out user");
    return HttpResponse.success({
        res,
        cookies: [lucia.createBlankSessionCookie().serialize()],
    });
};
