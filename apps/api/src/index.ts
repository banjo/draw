import { getUrl } from "@app/utils";
import * as trpcExpress from "@trpc/server/adapters/express";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { appRouter, createTRPCContext } from "server";

const app = express();
const url = getUrl();

app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
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

const PORT = Number(process.env.PORT) || 3003;
const isProd = process.env.NODE_ENV === "production";

console.log(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);

app.listen(PORT);
