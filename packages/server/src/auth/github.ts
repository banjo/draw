import { GitHub } from "arctic";
import { Env } from "common";
import { OauthCoreProvider, OauthUserInfo } from "./core";
import { OauthProvider } from "./providers";

const COOKIE_NAME = "github_oauth_state";
const env = Env.server();
export const github = new GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);

const getGithubUser = async (accessToken: string) => {
    const githubUserResponse = await fetch("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const githubUserData = await githubUserResponse.json();
    return OauthUserInfo.parse(githubUserData); // TODO: safe parse somehow?
};

const { login, callback } = OauthCoreProvider.createOauthProvider({
    provider: github,
    fetchUser: getGithubUser,
    cookieName: COOKIE_NAME,
    oauthProvider: OauthProvider.GITHUB,
});

export const GithubAuthProvider = { login, callback };
