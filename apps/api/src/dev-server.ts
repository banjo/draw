import { closeWss, WS_PORT, wss } from "@app/lib/ws";
import { Env } from "common";
import "dotenv/config";
import { app, PORT } from "./lib/http";
import { createContextLogger } from "server";

const logger = createContextLogger("dev-server");
const isProd = Env.server().NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error(error, "HTTP Server error");
});

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
    logger.error(error, `Unhandled rejection`);
});

process.on("uncaughtException", error => {
    logger.error(error, `Uncaught exception`);
});
