import { defineConfig } from "tsup";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
    clean: true,
    dts: true,
    entry: ["src/http-server.ts", "src/ws-server.ts"],
    format: ["cjs"],
    minify: isProduction,
    sourcemap: true,
    external: ["@prisma/client", "pino"],
});
