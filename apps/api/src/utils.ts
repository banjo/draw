import { raise } from "@banjoanton/utils";

export const isDev = () =>
    process.env.NODE_ENV === "development" && process.env.LOCAL_DEVELOPMENT === "true";

export const getUrl = () => {
    return process.env.CLIENT_URL ?? raise("CLIENT_URL is not defined");
};
