import { closeWss, wss } from "@app/lib/ws";
import "dotenv/config";
import { createContextLogger, startupLog } from "server";
import { app, PORT, server } from "./lib/http";

const logger = createContextLogger("prod-server");

app.on("error", error => {
    logger.error({ error }, "HTTP Server error");
});

wss.on("connection", ws => {
    logger.trace(`➕ Connection (${wss.clients.size})`);
    ws.once("close", () => {
        logger.trace(`➖ Connection (${wss.clients.size})`);
    });
});

server.listen(PORT, () => {
    startupLog("server");
});

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
