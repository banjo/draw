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

export { WS_PORT, closeWss, wss };
