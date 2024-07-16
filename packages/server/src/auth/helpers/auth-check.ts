import { AuthInfo } from "common";
import { Request, Response } from "express";
import { createContextLogger } from "../../lib/context-logger";
import { HttpResponse } from "../../model/http-response";

const logger = createContextLogger("oauth-core");

export const authCheck = (req: Request, res: Response) => {
    const user = res.locals.user;
    const session = res.locals.session;
    if (!user || !session) {
        return HttpResponse.unauthorized({ res, message: "Not authenticated" });
    }

    const data: AuthInfo = {
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
        name: user.name ?? undefined,
    };

    logger.trace("User is authenticated");
    return HttpResponse.success({ res, data });
};
