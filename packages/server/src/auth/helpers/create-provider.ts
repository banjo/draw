import { OAuth2ProviderWithPKCE } from "arctic";
import { callback } from "./callback";
import { login } from "./login";
import { FetchUser } from "./user-info";
import { Request, Response } from "express";
import { Cookie, SimpleOauthProvider } from "../models";
import { OauthProvider } from "../providers";

type CreateOauthCoreProviderProps = {
    provider: SimpleOauthProvider;
    oauthProvider: OauthProvider;
    cookies: Cookie[];
    fetchUser: FetchUser;
    scopes?: string[];
};

export const createOauthProvider = ({
    provider,
    fetchUser,
    cookies,
    oauthProvider,
    scopes,
}: CreateOauthCoreProviderProps) => ({
    login: async (req: Request, res: Response) =>
        login({ provider, res, cookies, providerType: "simple", scopes }),
    callback: async (req: Request, res: Response) =>
        callback({ provider, oauthProvider, fetchUser, req, res, cookies, providerType: "simple" }),
});

type CreateOauthCoreProviderWithPKCEProps = {
    provider: OAuth2ProviderWithPKCE;
    oauthProvider: OauthProvider;
    cookies: Cookie[];
    fetchUser: FetchUser;
    scopes: string[];
};
export const createOauthProviderWithPKCE = ({
    provider,
    fetchUser,
    cookies,
    oauthProvider,
    scopes,
}: CreateOauthCoreProviderWithPKCEProps) => ({
    login: async (req: Request, res: Response) =>
        login({ provider, res, cookies, providerType: "pkce", scopes }),
    callback: async (req: Request, res: Response) =>
        callback({
            provider,
            oauthProvider,
            fetchUser,
            req,
            res,
            cookies,
            providerType: "pkce",
        }),
});
