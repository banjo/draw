import { createLogger, Env } from "common";
import "dotenv/config";
import { app, PORT } from "./lib/http";

const logger = createLogger("HttpServer");
const isProd = Env.server().NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error(error);
});
