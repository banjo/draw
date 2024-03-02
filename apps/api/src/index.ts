import { app, PORT } from "@app/http-server";
import { closeWss, WS_PORT, wss } from "@app/ws-server";
import "dotenv/config";
import { createLogger } from "utils";

const logger = createLogger("api");
const isProd = process.env.NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error("Server error", error);
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
    logger.error("Unhandled rejection", error);
});

process.on("uncaughtException", error => {
    logger.error("Uncaught exception", error);
});
