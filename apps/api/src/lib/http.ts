import { getClientUrl } from "@app/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Env } from "common";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { appRouter, createTRPCContext } from "server";

const app = express();
const url = getClientUrl();
const PORT = Number(Env.server().PORT) || 3003;

app.use(
    "/trpc",
    createExpressMiddleware({
        middleware: cors({
            credentials: true,
            origin: url,
            allowedHeaders: ["Authorization", "Content-Type"],
        }),
        router: appRouter,
        createContext: opts => {
            const req = opts?.req;
            const res = opts?.res;

            return createTRPCContext({ req, res });
        },
    })
);

export { PORT, app };
