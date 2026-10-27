import { viteCommonjs } from "@originjs/vite-plugin-commonjs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths(), viteCommonjs()],
    server: {
        port: 3005,
        strictPort: true,
    },
    define: {
        "process.env.IS_PREACT": JSON.stringify("true"),
    },
});
