import { raise } from "@banjoanton/utils";

export const isDev = () => import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEVELOPMENT === "true";

export const getHttpUrl = () => {
    return import.meta.env.VITE_API_URL ?? raise("VITE_API_URL is not defined");
};

export const getWsUrl = () => {
    return import.meta.env.VITE_WS_URL ?? raise("VITE_WS_URL is not defined");
};
