import { cors } from "hono/cors";
import { logger } from "hono/logger";

import "dotenv/config";
import { createHonoInstance } from "../instance";
import { DrawController, drawController } from "./DrawController";

export const baseController = createHonoInstance().basePath("/api");

baseController.use("*", logger());
baseController.use(
    "*",
    cors({
        origin: "*",
    })
);

baseController.route("/", drawController);

export type BaseController = DrawController;
