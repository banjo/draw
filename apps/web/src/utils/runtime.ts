import { Env } from "common";

const env = Env.client();

export const isDev = () => env.DEV && env.VITE_LOCAL_DEVELOPMENT === "true";
export const getHttpUrl = () => env.VITE_API_URL;
export const getWsUrl = () => env.VITE_WS_URL;
