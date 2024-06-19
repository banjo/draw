import { closeWss, wss } from "@app/lib/ws";
import "dotenv/config";
import { createContextLogger, startupLog } from "server";

const logger = createContextLogger("ws-server");

wss.on("connection", ws => {
    logger.trace(`➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
        logger.trace(`➖ Connection (${wss.clients.size})`);
    });
});

startupLog("WebSocket Server", logger);

process.on("SIGTERM", () => {
    logger.info("SIGTERM");
    closeWss();
});

process.on("unhandledRejection", error => {
    logger.error(error, `Unhandled rejection`);
});

process.on("uncaughtException", error => {
    logger.error(error, `Uncaught exception`);
});
