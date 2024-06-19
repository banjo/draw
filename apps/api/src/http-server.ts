import { Env } from "common";
import "dotenv/config";
import { createContextLogger } from "server";
import { app, PORT } from "./lib/http";

const logger = createContextLogger("http-server");
const isProd = Env.server().NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error(error, "HTTP Server error");
});
