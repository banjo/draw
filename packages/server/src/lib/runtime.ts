import { raise } from "@banjoanton/utils";
import { Env } from "common";

const env = Env.server();

export const isLocalDevelopment = () =>
    env.NODE_ENV === "development" && env.LOCAL_DEVELOPMENT === "true";

export const getLocalDevelopmentId = () => {
    const id = env.DEVELOPMENT_UID ?? raise("No development UID");
    return Number(id);
};
