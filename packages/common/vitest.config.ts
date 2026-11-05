import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        server: {
            // Excalidraw imports JSON without import attributes, which Node needs
            deps: { inline: [/@excalidraw/] },
        },
    },
});
