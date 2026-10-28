#!/usr/bin/env node
import "dotenv/config";
import pc from "picocolors";

const env = process.env;
const DATABASE_URL = env.DATABASE_URL;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (!DATABASE_URL) {
    console.error(pc.red("❓ DATABASE_URL environment variable is not set. Aborting."));
    process.exit(1);
}

const isLocal = () => {
    try {
        return LOCAL_HOSTS.has(new URL(DATABASE_URL).hostname);
    } catch {
        return false;
    }
};

if (!isLocal()) {
    console.log(pc.red("🚫 You are trying to modify the production database. Aborting."));
    process.exit(1);
}
