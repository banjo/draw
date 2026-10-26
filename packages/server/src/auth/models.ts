import { OAuth2Provider } from "arctic";

export type CookieType = "code_verifier" | "state";
export type Cookie = {
    type: CookieType;
    name: string;
};

export type ProviderType = "simple" | "pkce";

/** A provider without PKCE that takes scopes, like GitHub. */
export type SimpleOauthProvider = OAuth2Provider & {
    createAuthorizationURL(state: string, options?: { scopes?: string[] }): Promise<URL>;
};
