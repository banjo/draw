import { generateCodeVerifier, generateState, OAuth2ProviderWithPKCE } from "arctic";
import { serializeCookie } from "oslo/cookie";
import { Env } from "common";
import { Response } from "express";
import { HttpResponse } from "../../model/http-response";
import { MAX_COOKIE_AGE } from "../core";
import { Cookie, ProviderType, SimpleOauthProvider } from "../models";

const env = Env.server();

const serializeOauthCookie = (name: string, value: string, maxAge: number) =>
    serializeCookie(name, value, {
        path: "/",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
        maxAge,
        sameSite: "lax",
    });

/** Expire the state and code verifier cookies once the login is done. */
export const clearOauthCookies = (cookies: Cookie[]) =>
    cookies.map(cookie => serializeOauthCookie(cookie.name, "", 0));

type BaseLoginProps = {
    providerType: ProviderType;
    res: Response;
    cookies: Cookie[];
    scopes?: string[];
};

type LoginSimpleProps = {
    providerType: "simple";
    provider: SimpleOauthProvider;
} & BaseLoginProps;

type LoginPKCEProps = {
    providerType: "pkce";
    provider: OAuth2ProviderWithPKCE;
} & BaseLoginProps;

type LoginProps = LoginSimpleProps | LoginPKCEProps;

export const login = async ({ provider, res, cookies, providerType, scopes }: LoginProps) => {
    const state = generateState();
    const stateCookie = cookies.find(c => c.type === "state");

    if (!stateCookie) {
        return HttpResponse.internalServerError({ res, message: "Could not start the login" });
    }

    if (providerType === "simple") {
        const url = await provider.createAuthorizationURL(state, scopes ? { scopes } : undefined);

        return HttpResponse.redirect({
            res,
            url: url.toString(),
            cookies: [serializeOauthCookie(stateCookie.name, state, MAX_COOKIE_AGE)],
        });
    }

    const codeVerifier = generateCodeVerifier();
    const url = await provider.createAuthorizationURL(
        state,
        codeVerifier,
        // @ts-ignore - this is the current way to define scopes for Google
        scopes ? { scopes } : undefined
    );

    const codeVerifierCookie = cookies.find(c => c.type === "code_verifier");

    if (!codeVerifierCookie) {
        return HttpResponse.internalServerError({ res, message: "Could not start the login" });
    }

    return HttpResponse.redirect({
        res,
        url: url.toString(),
        cookies: [
            serializeOauthCookie(stateCookie.name, state, MAX_COOKIE_AGE),
            serializeOauthCookie(codeVerifierCookie.name, codeVerifier, MAX_COOKIE_AGE),
        ],
    });
};
