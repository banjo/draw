import { generateState, GitHub } from "arctic";
import { Env } from "common";
import { Request, RequestHandler, Response } from "express";
import { Session, User } from "lucia";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { z } from "zod";
import { createContextLogger } from "../lib/context-logger";
import { lucia } from "../lib/lucia";
import { AuthRepository } from "../repositories/auth-repository";

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
    res.appendHeader(
        "Set-Cookie",
        serializeCookie(COOKIE_NAME, state, {
            path: "/",
            secure: env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 60 * 10,
            sameSite: "lax",
        })
    ).redirect(url.toString());
};

const handleExpressCallback = async (req: Request, res: Response) => {
    // TODO: handle try catch
    // TODO: handle multi account linking
    const code = req.query.code?.toString() ?? null;
    const state = req.query.state?.toString() ?? null;
    const storedState = parseCookies(req.headers.cookie ?? "").get(COOKIE_NAME) ?? null;

    if (!code || !state || !storedState || state !== storedState) {
        res.status(400).json({ error: "Invalid state" }).end();
        return;
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
        "GITHUB",
        githubUser.id.toString()
    );

    if (!oauthAccountResult.success) {
        logger.error({ message: oauthAccountResult.message }, "Failed to get oauth account");
        return res.status(500).json({ error: "Failed to get oauth account" }).end();
    }

    const redirectUrl = env.CLIENT_URL;
    logger.trace({ redirectUrl }, "Setting redirect url");
    const existingUser = oauthAccountResult.data;

    if (existingUser) {
        logger.trace(
            { provider: existingUser.provider, providerUserId: existingUser.providerUserId },
            "User exists"
        );
        const session = await lucia.createSession(Number(existingUser.providerUserId), {}); // TODO:: better check for number
        const sessionCookie = lucia.createSessionCookie(session.id);
        return res.appendHeader("Set-Cookie", sessionCookie.serialize()).redirect(redirectUrl);
    }

    logger.trace("Creating user");
    const userResponse = await AuthRepository.createOauthUser({
        email: githubUser.email,
        name: githubUser.name,
        provider: "GITHUB",
        providerUserId: githubUser.id.toString(),
    });

    if (!userResponse.success) {
        logger.error({ message: userResponse.message }, "Failed to create user");
        return res.status(500).json({ error: "Failed to create user" }).end();
    }

    const session = await lucia.createSession(userResponse.data.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    logger.trace({ redirectUrl }, "Redirecting after creating oauth user");
    return res.appendHeader("Set-Cookie", sessionCookie.serialize()).redirect(redirectUrl);
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
    return res.setHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize()).end();
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
