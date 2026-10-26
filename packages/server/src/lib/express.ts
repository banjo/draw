import { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpResponse } from "../model/http-response";
import { createContextLogger } from "./context-logger";

const logger = createContextLogger("express");

/** Express 4 doesn't catch rejected async handlers, which leaves the request hanging. */
export const handleErrors =
    (handler: RequestHandler): RequestHandler =>
    (req, res, next) =>
        Promise.resolve(handler(req, res, next)).catch(next);

/** Last middleware: log the error and answer with a generic message. */
export const errorMiddleware = (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    logger.error({ error }, "Unhandled error in request");

    if (res.headersSent) {
        next(error);
        return;
    }

    HttpResponse.internalServerError({ res, message: "Something went wrong" });
};
