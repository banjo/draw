import { hc } from "hono/client";
import { BaseController } from "server";

export const client = hc<BaseController>("http://localhost:3003/api");
