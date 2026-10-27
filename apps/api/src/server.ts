import { closeWss, wss } from "@app/lib/ws";
import "dotenv/config";
import { createContextLogger, drawingEmitter, startupLog } from "server";
import { PORT, server } from "./lib/http";

const logger = createContextLogger("prod-server");

const SHUTDOWN_TIMEOUT = 10_000;

server.on("error", error => {
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

let isShuttingDown = false;

// Save the drawings in memory before stopping, so a deploy or crash doesn't lose edits
const shutdown = async (reason: string, exitCode = 0) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ reason }, "Shutting down");

    closeWss();
    server.close();

    const timeout = new Promise<"timeout">(resolve =>
        setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT)
    );
    const saved = await Promise.race([drawingEmitter.saveAll(), timeout]);

    if (saved === "timeout") {
        logger.error("Timed out saving drawings before shutdown");
    } else {
        logger.info("Saved drawings before shutdown");
    }

    process.exit(exitCode);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", error => {
    logger.error({ error }, `Unhandled rejection`);
});

process.on("uncaughtException", error => {
    logger.error({ error }, `Uncaught exception`);
    shutdown("uncaughtException", 1);
});
