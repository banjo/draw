#!/usr/bin/env node
import "dotenv/config";
import pc from "picocolors";

const env = process.env;
const DATABASE_URL = env.DATABASE_URL;
const DATABASE_SECTION = "localhost";

if (!DATABASE_URL) {
    console.error(pc.red("❓ DATABASE_URL environment variable is not set. Aborting."));
    process.exit(1);
}

if (!DATABASE_URL.includes(DATABASE_SECTION)) {
    console.log(pc.red("🚫 You are trying to modify the production database. Aborting."));
    process.exit(1);
}
