import { createLogger } from "common";
import "dotenv/config";
import { app, PORT } from "./lib/http";

const logger = createLogger("http-server");
const isProd = process.env.NODE_ENV === "production";

app.listen(PORT, () => {
    logger.info(`🚀 Server ready at port ${PORT} - Mode: ${isProd ? "production" : "development"}`);
});

app.on("error", error => {
    logger.error(error);
});
