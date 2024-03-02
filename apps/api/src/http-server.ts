import { getClientUrl } from "@app/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { appRouter, createTRPCContext } from "server";
import { createLogger } from "utils";

const app = express();
const url = getClientUrl();
const PORT = Number(process.env.PORT) || 3003;
const logger = createLogger("http-server");

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

const isProd = process.env.NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error(error);
});
