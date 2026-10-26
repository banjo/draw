import { server } from "@app/lib/http";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createLogger } from "common";
import "dotenv/config";
import { appRouter, createWSContext } from "server";
import { WebSocketServer } from "ws";

const logger = createLogger("ws");

const wss = new WebSocketServer({
    server,
    // The default is 100 MB. Changes are small, and drawings without images are JSON
    maxPayload: 10 * 1024 * 1024,
});

const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: createWSContext,
});

const closeWss = () => {
    handler.broadcastReconnectNotification();
    wss.close();
    logger.info("🛑 WebSocket Server closed");
};

export { closeWss, handler, wss };
