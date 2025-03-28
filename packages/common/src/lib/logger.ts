import { isBrowser } from "@banjoanton/utils";
import pino, { TransportTargetOptions } from "pino";
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
        return pino({ name, level: clientVariables.VITE_LOG_LEVEL ?? "info" });
    }

    const targets: TransportTargetOptions[] = [
        {
            target: "pino-pretty",
            options: {
                colorize: true,
                ignore: "hostname,pid",
            },
            level: "trace",
        },
    ];

    // const env = Env.server();

    // if (env.NODE_ENV === "production") {
    //     const DATASET = env.AXIOM_DATASET;
    //     const AXIOM_TOKEN = env.AXIOM_TOKEN;

    //     targets.push({
    //         target: "@axiomhq/pino",
    //         options: {
    //             dataset: DATASET,
    //             token: AXIOM_TOKEN,
    //         },
    //         level: "trace",
    //     });
    // }

    // use shared transports to avoid memory leaks
    if (!sharedTransport) {
        sharedTransport = pino.transport({
            targets,
        });
    }

    const env = Env.allServer();

    const base = {
        env: env.NODE_ENV,
    };

    return pino(
        {
            name,
            level: env.LOG_LEVEL ?? "info",
            base,
            errorKey: "error",
        },
        sharedTransport
    );
};
