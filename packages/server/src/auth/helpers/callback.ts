import { OAuth2Provider, OAuth2ProviderWithPKCE } from "arctic";
import { parseCookies } from "oslo/cookie";
import { FetchUser } from "./user-info";
import { Env, Result } from "common";
import { Request, Response } from "express";
import { createContextLogger } from "../../lib/context-logger";
import { lucia } from "../../lib/lucia";
import { HttpResponse } from "../../model/http-response";
import { AuthRepository } from "../../repositories/auth-repository";
import { Cookie, ProviderType } from "../models";
import { OauthProvider } from "../providers";

const env = Env.server();
const logger = createContextLogger("oauth-core");

const getTokensFromSimpleProvider = async (
    req: Request,
    cookies: Cookie[],
    provider: OAuth2Provider
) => {
    const cookieName = cookies.find(c => c.type === "state")?.name;

    if (!cookieName) {
        logger.error("Could not find state cookie name");
        return Result.error("Could not find state cookie name");
    }

    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const storedState = parseCookies(req.headers.cookie ?? "").get(cookieName) ?? null;

    if (!code || !state || !storedState || state !== storedState) {
        logger.error("Invalid state");
        return Result.error("Invalid state");
    }

    logger.trace("Validating authorization code");
    const tokens = await provider.validateAuthorizationCode(code);

    return Result.ok(tokens);
};

const getTokensFromPKCEProvider = async (
    req: Request,
    cookies: Cookie[],
    provider: OAuth2ProviderWithPKCE
) => {
    const cookie = req.headers.cookie ?? "";
    const parsedCookies = parseCookies(cookie);

    const stateCookieName = cookies.find(c => c.type === "state")?.name;
    const codeVerifierCookieName = cookies.find(c => c.type === "code_verifier")?.name;

    if (!stateCookieName || !codeVerifierCookieName) {
        logger.error("Could not find state or code_verifier cookie name");
        return Result.error("Could not find state or code_verifier cookie name");
    }

    const stateCookie = parsedCookies.get(stateCookieName) ?? null;
    const codeVerifier = parsedCookies.get(codeVerifierCookieName) ?? null;

    const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const url = new URL(fullUrl);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");

    if (!state || !stateCookie || !code || stateCookie !== state || !codeVerifier) {
        logger.error({ state, stateCookie, code, codeVerifier, stateCookieName }, "Invalid state");
        return Result.error("Invalid state");
    }

    const tokens = await provider.validateAuthorizationCode(code, codeVerifier);
    return Result.ok(tokens);
};

type BaseHandleCallbackProps = {
    providerType: ProviderType;
    oauthProvider: OauthProvider;
    fetchUser: FetchUser;
    cookies: Cookie[];
    req: Request;
    res: Response;
};

type HandleSimpleCallbackProps = {
    providerType: "simple";
    provider: OAuth2Provider;
} & BaseHandleCallbackProps;

type HandlePKCECallbackProps = {
    providerType: "pkce";
    provider: OAuth2ProviderWithPKCE;
} & BaseHandleCallbackProps;

type HandleCallbackProps = HandleSimpleCallbackProps | HandlePKCECallbackProps;

// TODO: split up and add error handling
export const callback = async ({
    provider,
    oauthProvider,
    fetchUser,
    req,
    res,
    cookies,
    providerType,
}: HandleCallbackProps) => {
    const tokensResult =
        providerType === "simple"
            ? await getTokensFromSimpleProvider(req, cookies, provider)
            : await getTokensFromPKCEProvider(req, cookies, provider);

    if (!tokensResult.success) {
        logger.error({ message: tokensResult.message }, "Failed to get tokens");
        return HttpResponse.unauthorized({ res, message: tokensResult.message });
    }

    const tokens = tokensResult.data;
    logger.trace("Fetching user data");
    const oauthUserResult = await fetchUser(tokens.accessToken);

    if (!oauthUserResult.success) {
        logger.error({ message: oauthUserResult.message }, "Failed to fetch user data");
        return HttpResponse.internalServerError({ res, message: oauthUserResult.message });
    }

    const oauthUser = oauthUserResult.data;
    const userResult = await AuthRepository.getUserByEmail(oauthUser.email);

    if (!userResult.success) {
        logger.error({ message: userResult.message }, "Failed to get user by email");
        return HttpResponse.internalServerError({
            res,
            message: "Failed to get user by email",
        });
    }

    const existingUser = userResult.data;
    const redirectUrl = env.CLIENT_URL;
    logger.trace({ redirectUrl }, "Setting redirect url");

    if (existingUser) {
        logger.trace("User exists in database");

        const currentOauthAccountResult = await AuthRepository.getOauthByProvider(
            oauthProvider,
            oauthUser.id.toString()
        );

        if (!currentOauthAccountResult.success) {
            logger.error(
                { message: currentOauthAccountResult.message, provider: oauthProvider },
                "Failed to get oauth account"
            );
            return HttpResponse.internalServerError({
                res,
                message: "Failed to get oauth account",
            });
        }

        if (currentOauthAccountResult.data) {
            logger.trace("Oauth account already exists");

            const session = await lucia.createSession(Number(existingUser.id), {});
            const sessionCookie = lucia.createSessionCookie(session.id);
            return HttpResponse.redirect({
                res,
                url: redirectUrl,
                cookies: [sessionCookie.serialize()],
            });
        }

        const addOauthResult = await AuthRepository.addOauthAccount(Number(existingUser.id), {
            provider: oauthProvider,
            providerUserId: oauthUser.id.toString(),
            avatarUrl: oauthUser.avatar_url,
            name: oauthUser.name,
        });

        if (!addOauthResult.success) {
            logger.error(
                { message: addOauthResult.message, provider: oauthProvider },
                "Failed to add oauth account"
            );
            return HttpResponse.internalServerError({
                res,
                message: "Failed to add oauth account",
            });
        }

        const session = await lucia.createSession(Number(existingUser.id), {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        return HttpResponse.redirect({
            res,
            url: redirectUrl,
            cookies: [sessionCookie.serialize()],
        });
    }

    logger.trace({ provider: oauthProvider }, "Creating user from oauth data");
    const userResponse = await AuthRepository.createOauthUser({
        email: oauthUser.email,
        name: oauthUser.name,
        provider: oauthProvider,
        providerUserId: oauthUser.id.toString(),
        avatarUrl: oauthUser.avatar_url,
    });

    if (!userResponse.success) {
        logger.error({ message: userResponse.message }, "Failed to create user");
        return HttpResponse.internalServerError({ res, message: "Failed to create user" });
    }

    const session = await lucia.createSession(userResponse.data.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    logger.trace({ redirectUrl }, "Redirecting after creating oauth user");
    return HttpResponse.redirect({ res, url: redirectUrl, cookies: [sessionCookie.serialize()] });
};
