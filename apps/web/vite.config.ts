import react from "@vitejs/plugin-react";
import { cpSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig, Plugin } from "vite";

const require = createRequire(import.meta.url);

/**
 * Serves Excalidraw's fonts from the app instead of its CDN. Builds only: the dev server
 * keeps using the CDN.
 */
const excalidrawFonts = (): Plugin => {
    let outDir = "dist";

    return {
        name: "excalidraw-fonts",
        apply: "build",
        configResolved: config => {
            outDir = config.build.outDir;
        },
        transformIndexHtml: () => [
            {
                tag: "script",
                children: 'window.EXCALIDRAW_ASSET_PATH = "/";',
                injectTo: "head-prepend",
            },
        ],
        writeBundle: () => {
            // dist/prod/index.js, next to the fonts
            const prodDir = dirname(require.resolve("@excalidraw/excalidraw"));
            cpSync(join(prodDir, "fonts"), join(outDir, "fonts"), { recursive: true });
        },
    };
};

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), excalidrawFonts()],
    resolve: { tsconfigPaths: true },
    server: {
        port: 3005,
        strictPort: true,
    },
});
