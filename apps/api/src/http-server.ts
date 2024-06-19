import "dotenv/config";
import { createContextLogger, startupLog } from "server";
import { app, PORT } from "./lib/http";

const logger = createContextLogger("http-server");

app.listen(PORT, () => {
    startupLog("HTTP Server", logger);
});

app.on("error", error => {
    logger.error(error, "HTTP Server error");
});
