import { getUrl } from "@app/utils";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { appRouter, createTRPCContext } from "server";
import { createLogger } from "utils";
import { WebSocketServer } from "ws";
const app = express();
const url = getUrl();
const logger = createLogger("api");

const wss = new WebSocketServer({
    port: 3004,
});

const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: opts => {
        const req = opts?.req;
        const res = opts?.res;

        return createTRPCContext({ req, res });
    },
});

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

const PORT = Number(process.env.PORT) || 3003;
const isProd = process.env.NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

wss.on("connection", ws => {
    console.log(`➕➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
        console.log(`➖➖ Connection (${wss.clients.size})`);
    });
});
console.log("✅ WebSocket Server listening on ws://localhost:3004");

const closeWss = () => {
    handler.broadcastReconnectNotification();
    wss.close();
    console.log("🛑 WebSocket Server closed");
};

process.on("SIGTERM", () => {
    console.log("SIGTERM");
    closeWss();
});

app.on("error", error => {
    logger.error("Server error", error);
});

process.on("unhandledRejection", error => {
    logger.error("Unhandled rejection", error);
});

process.on("uncaughtException", error => {
    logger.error("Uncaught exception", error);
});
