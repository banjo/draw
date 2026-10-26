import { OAuth2Provider, OAuth2ProviderWithPKCE } from "arctic";
import { parseCookies } from "oslo/cookie";
import { Env, Result } from "common";
import { Request, Response } from "express";
import { createContextLogger } from "../../lib/context-logger";
import { lucia } from "../../lib/lucia";
import { HttpResponse } from "../../model/http-response";
import { Cookie, ProviderType } from "../models";
import { OauthProvider } from "../providers";
import { findOrCreateUser } from "./find-or-create-user";
import { clearOauthCookies } from "./login";
import { FetchUser } from "./user-info";

const env = Env.server();
const logger = createContextLogger("oauth-core");

type ValidateCode = (
    code: string,
    codeVerifier: string | undefined
) => Promise<{ accessToken: string }>;

/** Check the state against its cookie, and exchange the code for tokens. */
const getTokens = async (req: Request, cookies: Cookie[], validateCode: ValidateCode) => {
    const parsedCookies = parseCookies(req.headers.cookie ?? "");
    const cookieValue = (type: Cookie["type"]) => {
        const name = cookies.find(c => c.type === type)?.name;
        return name ? parsedCookies.get(name) : undefined;
    };

    const code = req.query.code?.toString();
    const state = req.query.state?.toString();
    const storedState = cookieValue("state");
    const codeVerifier = cookieValue("code_verifier");
    const needsVerifier = cookies.some(c => c.type === "code_verifier");

    if (!code || !state || !storedState || state !== storedState) {
        logger.error(
            { hasCode: Boolean(code), hasStoredState: Boolean(storedState) },
            "Invalid state"
        );
        return Result.error("Invalid state");
    }

    if (needsVerifier && !codeVerifier) {
        logger.error("Missing code verifier");
        return Result.error("Invalid state");
    }

    try {
        return Result.ok(await validateCode(code, codeVerifier));
    } catch (error) {
        // An expired or reused code, or the provider is down
        logger.error({ error }, "Could not validate authorization code");
        return Result.error("Could not validate the login");
    }
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

export const callback = async (props: HandleCallbackProps) => {
    const { oauthProvider, fetchUser, req, res, cookies } = props;
    const clearedCookies = clearOauthCookies(cookies);

    const validateCode: ValidateCode =
        props.providerType === "simple"
            ? code => props.provider.validateAuthorizationCode(code)
            : (code, codeVerifier) =>
                  props.provider.validateAuthorizationCode(code, codeVerifier ?? "");

    const tokens = await getTokens(req, cookies, validateCode);
    if (!tokens.success) {
        return HttpResponse.unauthorized({ res, message: tokens.message, cookies: clearedCookies });
    }

    const oauthUser = await fetchUser(tokens.data.accessToken);
    if (!oauthUser.success) {
        logger.error(
            { message: oauthUser.message, provider: oauthProvider },
            "Failed to fetch user"
        );
        return HttpResponse.internalServerError({
            res,
            message: "Could not sign in",
            cookies: clearedCookies,
        });
    }

    const userId = await findOrCreateUser(oauthProvider, oauthUser.data);
    if (!userId.success) {
        logger.error({ message: userId.message, provider: oauthProvider }, "Failed to sign in");
        return userId.type === "Unauthorized"
            ? HttpResponse.unauthorized({
                  res,
                  message: "Verify your email with the provider to sign in",
                  cookies: clearedCookies,
              })
            : HttpResponse.internalServerError({
                  res,
                  message: "Could not sign in",
                  cookies: clearedCookies,
              });
    }

    const session = await lucia.createSession(userId.data, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    logger.trace({ provider: oauthProvider, userId: userId.data }, "Signed in");

    return HttpResponse.redirect({
        res,
        url: env.CLIENT_URL,
        cookies: [...clearedCookies, sessionCookie.serialize()],
    });
};
