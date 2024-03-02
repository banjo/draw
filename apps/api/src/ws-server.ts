import { applyWSSHandler } from "@trpc/server/adapters/ws";
import "dotenv/config";
import { appRouter, createTRPCContext } from "server";
import { createLogger } from "utils";
import { WebSocketServer } from "ws";

const logger = createLogger("ws-server");
const WS_PORT = Number(process.env.WS_PORT) || 3004;

const wss = new WebSocketServer({
    port: WS_PORT,
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

const closeWss = () => {
    handler.broadcastReconnectNotification();
    wss.close();
    logger.info("🛑 WebSocket Server closed");
};

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
