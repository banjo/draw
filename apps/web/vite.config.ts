import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    build: {
        rollupOptions: {
            external: ["ui/styles/globals.css"],
        },
    },
    server: {
        host: "0.0.0.0",
        port: 3000,
    },
    define: {
        "process.env.IS_PREACT": JSON.stringify("true"),
    },
});
