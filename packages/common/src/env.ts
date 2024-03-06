import { isBrowser } from "@banjoanton/utils";
import { z } from "zod";
import { LOG_LEVELS } from "./lib/logger";

const fromZodError = (error: z.ZodError): string => {
    const message = ["Invalid environment variables:"];

    const affected = error.issues.map(issue => issue.path.join(".")).join(", ");
    message.push(affected);

    return message.join(" ");
};

const allClient = () => {
    if (!isBrowser()) {
        throw new Error("Client env is only available in the browser");
    }

    // @ts-ignore - Vite injects the env on client
    return import.meta.env as Record<string, string>;
};

const allServer = () => {
    if (isBrowser()) {
        throw new Error("Server env is only available in Node");
    }
    return process.env;
};

const ServerEnvSchema = z.object({
    DATABASE_URL: z.string(),
    FIREBASE_ADMIN_KEY: z.string(),
    CLIENT_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production"]),
    LOCAL_DEVELOPMENT: z.enum(["true", "false"]).optional(),
    PORT: z.string(),
    WS_PORT: z.string(),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    // AXIOM_DATASET: z.string(),
    // AXIOM_TOKEN: z.string(),
});

const server = () => {
    if (isBrowser()) {
        throw new Error("Server env is only available in Node");
    }

    const env = allServer();
    const parsed = ServerEnvSchema.safeParse(env);
    if (!parsed.success) {
        throw new Error(fromZodError(parsed.error));
    }
    return parsed.data;
};

const ClientEnvSchema = z.object({
    VITE_API_URL: z.string().url(),
    VITE_WS_URL: z.string().url(),
    VITE_DEVELOPMENT_UID: z.string().optional(),
    VITE_LOCAL_DEVELOPMENT: z.enum(["true", "false"]).optional(),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
});

const client = () => {
    if (!isBrowser()) {
        throw new Error("Client env is only available in the browser");
    }
    const env = allClient();
    const parsed = ClientEnvSchema.safeParse(env);
    if (!parsed.success) {
        throw new Error(fromZodError(parsed.error));
    }
    return parsed.data;
};

export const Env = { server, client, allClient, allServer };
