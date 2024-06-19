import { closeWss, wss } from "@app/lib/ws";
import { createLogger } from "common";
import "dotenv/config";
import { startupLog } from "server";

const logger = createLogger("ws-server");

wss.on("connection", ws => {
    logger.trace(`➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
        logger.trace(`➖ Connection (${wss.clients.size})`);
    });
});

startupLog("WebSocket Server");

process.on("SIGTERM", () => {
    logger.info("SIGTERM");
    closeWss();
});

process.on("unhandledRejection", error => {
    logger.error({ error }, `Unhandled rejection`);
});

process.on("uncaughtException", error => {
    logger.error({ error }, `Uncaught exception`);
});
