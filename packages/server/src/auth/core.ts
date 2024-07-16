import { toSeconds } from "@banjoanton/utils";
import { Session, User } from "lucia";
import { authCheck } from "./helpers/auth-check";
import { createOauthProvider, createOauthProviderWithPKCE } from "./helpers/create-provider";
import { logout } from "./helpers/logout";
import { middleware } from "./helpers/middleware";

export const MAX_COOKIE_AGE = toSeconds({ minutes: 10 });

export const OauthCoreProvider = {
    logout,
    middleware,
    authCheck,
    createOauthProvider,
    createOauthProviderWithPKCE,
};

declare global {
    namespace Express {
        interface Locals {
            user: User | null;
            session: Session | null;
        }
    }
}
