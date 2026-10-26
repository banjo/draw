import { GitHub } from "arctic";
import { Env, Result } from "common";
import { FetchUser, OauthUserInfo } from "../helpers/user-info";
import { OauthCoreProvider } from "../core";
import { OauthProvider } from "../providers";
import { Cookie } from "../models";
import { wrapAsync } from "@banjoanton/utils";
import { ofetch } from "ofetch";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";

const COOKIE_NAME = "github_oauth_state";
const env = Env.server();
const logger = createContextLogger("github-auth-provider");
const provider = new GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

// The profile email is null when it's private, so read the email addresses instead
const scopes = ["user:email"];

const GithubUserSchema = z.object({
    id: z.number(),
    login: z.string(),
    name: z.string().nullish(),
    avatar_url: z.string().nullish(),
});

const GithubEmailsSchema = z
    .object({ email: z.string(), primary: z.boolean(), verified: z.boolean() })
    .array();

const fetchUser: FetchUser = async (accessToken: string) => {
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [data, error] = await wrapAsync(async () => {
        const [user, emails] = await Promise.all([
            ofetch("https://api.github.com/user", { headers }),
            ofetch("https://api.github.com/user/emails", { headers }),
        ]);
        return { user: GithubUserSchema.parse(user), emails: GithubEmailsSchema.parse(emails) };
    });

    if (error) {
        logger.error({ error }, "Error fetching user");
        return Result.error("Could not fetch the GitHub user");
    }

    const primary = data.emails.find(email => email.primary) ?? data.emails[0];

    const parsed = OauthUserInfo.safeParse({
        id: data.user.id.toString(),
        email: primary?.email,
        emailVerified: primary?.verified ?? false,
        name: data.user.name ?? data.user.login,
        avatar_url: data.user.avatar_url ?? undefined,
    });

    if (!parsed.success) {
        logger.error({ error: parsed.error }, "Unexpected GitHub user");
        return Result.error("Could not read the GitHub user");
    }

    return Result.ok(parsed.data);
};

const cookies: Cookie[] = [
    {
        name: COOKIE_NAME,
        type: "state",
    },
];

const { login, callback } = OauthCoreProvider.createOauthProvider({
    provider,
    fetchUser,
    cookies,
    oauthProvider: OauthProvider.GITHUB,
    scopes,
});

export const GithubAuthProvider = { login, callback };
