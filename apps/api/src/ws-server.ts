import { closeWss, WS_PORT, wss } from "@app/lib/ws";
import { createLogger } from "common";
import "dotenv/config";

const logger = createLogger("WsServer");

wss.on("connection", ws => {
    logger.trace(`➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
        logger.trace(`➖ Connection (${wss.clients.size})`);
    });
});

logger.info(`✅ WebSocket Server listening on at port ${WS_PORT}`);

process.on("SIGTERM", () => {
    logger.info("SIGTERM");
    closeWss();
});

process.on("unhandledRejection", error => {
    logger.error(`Unhandled rejection: ${error}`);
});

process.on("uncaughtException", error => {
    logger.error(`Uncaught exception: ${error}`);
});
