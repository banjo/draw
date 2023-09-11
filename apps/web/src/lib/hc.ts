import { hc } from "hono/client";
import { BaseController } from "server";

const localUrl = "http://localhost:3003";
const url = import.meta.env.VITE_API_URL ?? localUrl;

export const client = hc<BaseController>(`${url}/api`);
