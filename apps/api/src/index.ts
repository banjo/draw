import "dotenv/config";
import { appRouter, createTRPCContext } from "server";

import express from "express";

import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";

const app = express();

// TODO: set origin to production URL or dev url

app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
        middleware: cors({
            credentials: true,
            origin: "http://localhost:3005",
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

const PORT = Number(process.env.PORT) || 3003;
const isProd = process.env.NODE_ENV === "production";

console.log(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);

app.listen(PORT);
