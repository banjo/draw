import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createLogger, Env } from "common";
import "dotenv/config";
import { appRouter } from "server";
import { WebSocketServer } from "ws";

const logger = createLogger("ws");
const WS_PORT = Number(Env.server().WS_PORT) || 3004;

const wss = new WebSocketServer({
    port: WS_PORT,
});

const handler = applyWSSHandler({
    wss,
    router: appRouter,
    // @ts-ignore - strange TS error
    createContext: opts => {
        const req = opts?.req;
        const res = opts?.res;

        // TODO: auth does not work with ws for now, fix?: https://www.reddit.com/r/node/comments/117fgb5/trpc_correct_way_to_authorize_websocket/
        return { req, res, expired: false, userId: undefined };
    },
});

const closeWss = () => {
    handler.broadcastReconnectNotification();
    wss.close();
    logger.info("🛑 WebSocket Server closed");
};

export { closeWss, handler, WS_PORT, wss };
