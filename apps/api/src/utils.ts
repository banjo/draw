import { Env } from "common";

const env = Env.server();
export const isDev = () => env.NODE_ENV === "development" && env.LOCAL_DEVELOPMENT === "true";
