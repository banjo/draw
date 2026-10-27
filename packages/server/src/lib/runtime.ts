import { Env } from "common";

const env = Env.server();

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const isLocalDatabase = () => {
    try {
        return LOCAL_HOSTS.has(new URL(env.DATABASE_URL).hostname);
    } catch {
        return false;
    }
};

/**
 * Local sign-in without OAuth. It needs all three, so a stray `LOCAL_DEVELOPMENT` in
 * production can't turn it on.
 */
export const isLocalDevelopment = () =>
    env.NODE_ENV === "development" && env.LOCAL_DEVELOPMENT === "true" && isLocalDatabase();
