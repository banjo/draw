export const OAUTH_PROVIDERS = ["GITHUB"] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];
