import { serve } from "@hono/node-server";
import { baseController } from "server";

import "dotenv/config";

const app = baseController;

const PORT = Number(process.env.PORT) || 3003;
const isProd = process.env.NODE_ENV === "production";

console.log(process.env);

console.log(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);

serve({
    fetch: app.fetch,
    port: PORT,
});
