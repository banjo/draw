import { isBrowser } from "@banjoanton/utils";
import pino from "pino";
import { Env } from "../env";
// * Pino import needs to be default to work in the browser
// * This file cannot parse with Env.server() because this file is loaded before the .env file.

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharedTransport: any;

export const createLogger = (name: string) => {
    if (isBrowser()) {
        const clientVariables = Env.allClient();
        return pino({ name, level: clientVariables.VITE_LOG_LEVEL || "info" });
    }

    const env = Env.allServer();
    const options = {
        name,
        level: env.LOG_LEVEL || "info",
        base: { env: env.NODE_ENV },
        errorKey: "error",
    };

    // Plain JSON lines in production, for the log collector; readable lines when developing
    if (env.NODE_ENV === "production") return pino(options);

    // One transport for every logger, as each starts a worker thread
    sharedTransport ??= pino.transport({
        targets: [
            {
                target: "pino-pretty",
                options: { colorize: true, ignore: "hostname,pid" },
                level: "trace",
            },
        ],
    });

    return pino(options, sharedTransport);
};
