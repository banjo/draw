import { closeWss, WS_PORT, wss } from "@app/lib/ws";
import { createLogger, Env } from "common";
import "dotenv/config";
import { app, PORT } from "./lib/http";

const logger = createLogger("DevServer");
const isProd = Env.server().NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error(error);
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
    logger.error(`Unhandled rejection: ${error}`);
});

process.on("uncaughtException", error => {
    logger.error(`Uncaught exception: ${error}`);
});
