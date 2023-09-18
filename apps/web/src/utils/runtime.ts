import { raise } from "@banjoanton/utils";

export const isDev = () => import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEVELOPMENT === "true";

export const getUrl = () => {
    return import.meta.env.VITE_API_URL ?? raise("VITE_API_URL is not defined");
};
