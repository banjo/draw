import { Google } from "arctic";
import { Env, Result } from "common";
import { Cookie } from "../models";
import { OauthProvider } from "../providers";
import { OauthCoreProvider } from "../core";
import { FetchUser, OauthUserInfo } from "../helpers/user-info";
import { z } from "zod";
import { ofetch } from "ofetch";
import { wrapAsync } from "@banjoanton/utils";
import { createContextLogger } from "../../lib/context-logger";

const STATE_COOKIE_NAME = "google_oauth_state";
const CODE_VERIFIER_COOKIE_NAME = "google_code_verifier";

const logger = createContextLogger("google-auth-provider");

const scopes = ["profile", "email"];

const env = Env.server();
const provider = new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
);

const GoogleUserInfoSchema = z.object({
    sub: z.string(),
    name: z.string().optional(),
    picture: z.string().optional(),
    email: z.string(),
    email_verified: z.boolean(),
});

type GoogleUserInfo = z.infer<typeof GoogleUserInfoSchema>;

const fetchUser: FetchUser = async accessToken => {
    const [googleUser, error] = await wrapAsync(async () => {
        const user = await ofetch<GoogleUserInfo>(
            "https://openidconnect.googleapis.com/v1/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        return GoogleUserInfoSchema.parse(user);
    });

    if (error) {
        logger.error({ error }, "Error fetching user");
        return Result.error("Could not fetch the Google user");
    }

    const parsed = OauthUserInfo.safeParse({
        id: googleUser.sub,
        email: googleUser.email,
        emailVerified: googleUser.email_verified,
        name: googleUser.name,
        avatar_url: googleUser.picture,
    });

    if (!parsed.success) {
        logger.error({ error: parsed.error }, "Unexpected Google user");
        return Result.error("Could not read the Google user");
    }

    return Result.ok(parsed.data);
};

const cookies: Cookie[] = [
    {
        name: STATE_COOKIE_NAME,
        type: "state",
    },
    {
        name: CODE_VERIFIER_COOKIE_NAME,
        type: "code_verifier",
    },
];

const { login, callback } = OauthCoreProvider.createOauthProviderWithPKCE({
    provider,
    fetchUser,
    cookies,
    oauthProvider: OauthProvider.GOOGLE,
    scopes,
});

export const GoogleAuthProvider = { login, callback };
