import { generateState, OAuth2Provider } from "arctic";
import { AuthInfo, Env } from "common";
import { Request, RequestHandler, Response } from "express";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { createContextLogger } from "../lib/context-logger";
import { lucia } from "../lib/lucia";
import { AuthRepository } from "../repositories/auth-repository";
import { HttpResponse } from "../model/http-response";
import { OauthProvider } from "./providers";
import { Session, User } from "lucia";
import { z } from "zod";

const logger = createContextLogger("oauth-core");
const env = Env.server();

export const OauthUserInfo = z.object({
    id: z.number(),
    email: z.string(),
    avatar_url: z.string().optional(),
    name: z.string().optional(),
});

export type OauthUserInfo = z.infer<typeof OauthUserInfo>;

const generateUrlAndState = async (provider: OAuth2Provider) => {
    const state = generateState();
    const url = await provider.createAuthorizationURL(state);
    return { url, state };
};

type LoginProps = {
    arcticProvider: OAuth2Provider;
    res: Response;
    cookieName: string;
};

const login = async ({ arcticProvider, res, cookieName }: LoginProps) => {
    const { url, state } = await generateUrlAndState(arcticProvider);
    const cookie = serializeCookie(cookieName, state, {
        path: "/",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax",
    });

    return HttpResponse.redirect({ res, url: url.toString(), cookie });
};

type HandleCallbackProps = {
    provider: OAuth2Provider;
    oauthProvider: OauthProvider;
    fetchUser: (accessToken: string) => Promise<OauthUserInfo>;
    cookieName: string;
    req: Request;
    res: Response;
};

// TODO: split up and add error handling
const callback = async ({
    provider,
    oauthProvider,
    fetchUser,
    req,
    res,
    cookieName,
}: HandleCallbackProps) => {
    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const storedState = parseCookies(req.headers.cookie ?? "").get(cookieName) ?? null;

    if (!code || !state || !storedState || state !== storedState) {
        return HttpResponse.unauthorized({ res, message: "Invalid state" });
    }

    logger.trace("Validating authorization code");
    const tokens = await provider.validateAuthorizationCode(code);

    logger.trace("Fetching user data");
    const oauthUser = await fetchUser(tokens.accessToken);

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
                cookie: sessionCookie.serialize(),
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
            cookie: sessionCookie.serialize(),
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
    return HttpResponse.redirect({ res, url: redirectUrl, cookie: sessionCookie.serialize() });
};

const logout = async (req: Request, res: Response) => {
    if (!res.locals.session) {
        logger.trace("No session to sign out");
        return res.status(401).end();
    }

    await lucia.invalidateSession(res.locals.session.id);

    logger.trace("Signing out user");
    return HttpResponse.success({
        res,
        cookie: lucia.createBlankSessionCookie().serialize(),
    });
};

const middleware: RequestHandler = async (req, res, next) => {
    logger.trace("Auth middleware initiated");
    const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");

    if (!sessionId) {
        logger.trace("No session id");
        res.locals.user = null;
        res.locals.session = null;
        return next();
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (session && session.fresh) {
        logger.trace("Updating session cookie");
        res.appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize());
    }

    if (!session) {
        logger.trace("Removing session cookie");
        res.appendHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize());
    }

    logger.trace("Successfully authenticated user");
    res.locals.session = session;
    res.locals.user = user;
    return next();
};

const authCheck = (req: Request, res: Response) => {
    const user = res.locals.user;
    const session = res.locals.session;
    if (!user || !session) {
        return HttpResponse.unauthorized({ res, message: "Not authenticated" });
    }

    const data: AuthInfo = {
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
        name: user.name ?? undefined,
    };

    logger.trace("User is authenticated");
    return HttpResponse.success({ res, data });
};

type CreateOauthCoreProviderProps = {
    provider: OAuth2Provider;
    oauthProvider: OauthProvider;
    cookieName: string;
    fetchUser: (accessToken: string) => Promise<OauthUserInfo>;
};
const createOauthProvider = ({
    provider,
    fetchUser,
    cookieName,
    oauthProvider,
}: CreateOauthCoreProviderProps) => ({
    login: async (req: Request, res: Response) =>
        login({ arcticProvider: provider, res, cookieName }),
    callback: async (req: Request, res: Response) =>
        callback({ provider, oauthProvider, fetchUser, req, res, cookieName }),
});

export const OauthCoreProvider = {
    logout,
    middleware,
    authCheck,
    createOauthProvider,
};

declare global {
    namespace Express {
        interface Locals {
            user: User | null;
            session: Session | null;
        }
    }
}
