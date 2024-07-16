export type CookieType = "code_verifier" | "state";
export type Cookie = {
    type: CookieType;
    name: string;
};

export type ProviderType = "simple" | "pkce";
