import { getClientUrl } from "@app/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Env } from "common";
import { appRouter, createTRPCContext, NodeContext } from "server";
import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();
const url = getClientUrl();
const PORT = Number(Env.server().PORT) || 3003;

app.use(NodeContext.setupContext);

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
