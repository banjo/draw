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

/** Treat `KEY=` as unset, so empty values in .env files don't fail optional checks. */
const withoutEmpty = (env: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));

const allServer = () => {
    if (isBrowser()) {
        throw new Error("Server env is only available in Node");
    }
    return process.env;
};

const ServerEnvSchema = z.object({
    DATABASE_URL: z.string(),
    CLIENT_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production"]),
    // Turns on /login/local, with NODE_ENV=development and a database on localhost
    LOCAL_DEVELOPMENT: z.enum(["true", "false"]).optional(),
    PORT: z.string(),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
    // GITHUB AUTH
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    // GOOGLE AUTH
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GOOGLE_REDIRECT_URI: z.string(),
    // CLOUDFLARE BUCKET
    CLOUDFLARE_ACCOUNT_ID: z.string(),
    CLOUDFLARE_ACCESS_KEY_ID: z.string(),
    CLOUDFLARE_SECRET_ACCESS_KEY: z.string(),
    CLOUDFLARE_BUCKET_NAME: z.string(),
    // Local S3 stand-in instead of R2, e.g. http://localhost:9000 (see docker/docker-compose.yml)
    CLOUDFLARE_ENDPOINT: z.string().url().optional(),
    // AXIOM_DATASET: z.string(),
    // AXIOM_TOKEN: z.string(),
});

const server = () => {
    if (isBrowser()) {
        throw new Error("Server env is only available in Node");
    }

    const parsed = ServerEnvSchema.safeParse(withoutEmpty(allServer()));
    if (!parsed.success) {
        throw new Error(fromZodError(parsed.error));
    }
    return parsed.data;
};

const ClientEnvSchema = z.object({
    VITE_API_URL: z.string().url(),
    VITE_WS_URL: z.string().url(),
    // Shows the "Sign in locally" button. The API needs LOCAL_DEVELOPMENT=true
    VITE_LOCAL_DEVELOPMENT: z.enum(["true", "false"]).optional(),
    VITE_LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
});

const client = () => {
    if (!isBrowser()) {
        throw new Error("Client env is only available in the browser");
    }
    const parsed = ClientEnvSchema.safeParse(withoutEmpty(allClient()));
    if (!parsed.success) {
        throw new Error(fromZodError(parsed.error));
    }
    return parsed.data;
};

export const Env = { server, client, allClient, allServer };
