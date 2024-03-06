import { isBrowser } from "@banjoanton/utils";
import pino, { TransportTargetOptions } from "pino";
// Pino import needs to be default to work in the browser

let sharedTransport: any;

export const createLogger = (name: string) => {
    if (isBrowser()) {
        return pino({ name });
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

    if (!sharedTransport) {
        sharedTransport = pino.transport({
            targets,
        });
    }

    return pino({ name, level: "trace" }, sharedTransport);
};

export { type Logger } from "pino";
