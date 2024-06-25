import { generateState, GitHub } from "arctic";
import { Env } from "common";
import { Request, RequestHandler, Response } from "express";
import { Session, User } from "lucia";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { z } from "zod";
import { createContextLogger } from "../lib/context-logger";
import { lucia } from "../lib/lucia";
import { AuthRepository } from "../repositories/auth-repository";
import { OauthProvider } from "./providers";
import { HttpResponse } from "../model/http-response";

const logger = createContextLogger("github-auth-provider");

const GithubUser = z.object({
    id: z.number(),
    login: z.string(),
    email: z.string(),
    avatar_url: z.string(),
    name: z.string(),
});

const COOKIE_NAME = "github_oauth_state";
const env = Env.server();
export const github = new GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

const generateUrlAndState = async () => {
    const state = generateState();
    const url = await github.createAuthorizationURL(state);
    return {
        url,
        state,
    };
};

const handleExpressLogin = async (req: Request, res: Response) => {
    const { url, state } = await generateUrlAndState();
    const cookie = serializeCookie(COOKIE_NAME, state, {
        path: "/",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax",
    });

    return HttpResponse.redirect({ res, url: url.toString(), cookie });
};

const handleExpressCallback = async (req: Request, res: Response) => {
    // TODO: handle try catch
    // TODO: handle multi account linking
    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const storedState = parseCookies(req.headers.cookie ?? "").get(COOKIE_NAME) ?? null;

    if (!code || !state || !storedState || state !== storedState) {
        return HttpResponse.unauthorized({ res, message: "Invalid state" });
    }

    logger.trace("Validating authorization code");
    const tokens = await github.validateAuthorizationCode(code);

    logger.trace("Fetching user data");
    const githubUserResponse = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
        },
    });
    const githubUserData = await githubUserResponse.json();
    const githubUser = GithubUser.parse(githubUserData);

    const oauthAccountResult = await AuthRepository.getOauthByProvider(
        OauthProvider.GITHUB,
        githubUser.id.toString()
    );

    if (!oauthAccountResult.success) {
        logger.error({ message: oauthAccountResult.message }, "Failed to get oauth account");
        return HttpResponse.internalServerError({ res, message: "Failed to get oauth account" });
    }

    const redirectUrl = env.CLIENT_URL;
    logger.trace({ redirectUrl }, "Setting redirect url");
    const existingOauth = oauthAccountResult.data;

    if (existingOauth) {
        logger.trace(
            { provider: existingOauth.provider, providerUserId: existingOauth.providerUserId },
            "User exists"
        );
        const session = await lucia.createSession(Number(existingOauth.userId), {}); // TODO:: better check for number
        const sessionCookie = lucia.createSessionCookie(session.id);
        return HttpResponse.redirect({ res, url: redirectUrl, cookie: sessionCookie.serialize() });
    }

    logger.trace("Creating user");
    const userResponse = await AuthRepository.createOauthUser({
        email: githubUser.email,
        name: githubUser.name,
        provider: OauthProvider.GITHUB,
        providerUserId: githubUser.id.toString(),
        avatarUrl: githubUser.avatar_url,
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

const handleExpressMiddleware: RequestHandler = async (req, res, next) => {
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
        logger.trace("Remvoing session cookie");
        res.appendHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize());
    }

    logger.trace("Successfully authenticated user");
    res.locals.session = session;
    res.locals.user = user;
    return next();
};

const handleExpressSignOut = async (req: Request, res: Response) => {
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

export const GithubAuthProvider = {
    handleExpressLogin,
    handleExpressCallback,
    handleExpressMiddleware,
    handleExpressSignOut,
    COOKIE_NAME,
};

declare global {
    namespace Express {
        interface Locals {
            user: User | null;
            session: Session | null;
        }
    }
}
