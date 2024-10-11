import { GitHub } from "arctic";
import { Env, Result } from "common";
import { FetchUser, OauthUserInfo } from "../helpers/user-info";
import { OauthCoreProvider } from "../core";
import { OauthProvider } from "../providers";
import { Cookie } from "../models";
import { wrapAsync } from "@banjoanton/utils";
import { ofetch } from "ofetch";
import { createContextLogger } from "../../lib/context-logger";

const COOKIE_NAME = "github_oauth_state";
const env = Env.server();
const logger = createContextLogger("github-auth-provider");
const provider = new GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

const fetchUser: FetchUser = async (accessToken: string) => {
    const [githubUserData, error] = await wrapAsync(
        async () =>
            await ofetch<OauthUserInfo>("https://api.github.com/user", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            })
    );

    if (error) {
        logger.error({ error }, "Error fetching user");
        return Result.error(error.message);
    }

    const parsed = OauthUserInfo.parse(githubUserData);
    return Result.ok(parsed);
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
});

export const GithubAuthProvider = { login, callback };
