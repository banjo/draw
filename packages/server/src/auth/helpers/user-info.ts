import { ResultType } from "@banjoanton/utils";
import { z } from "zod";

export const OauthUserInfo = z.object({
    /** The provider's user id. A string, as Google ids are too long for a number. */
    id: z.string().min(1),
    email: z
        .string()
        .email()
        .transform(email => email.toLowerCase()),
    /** Only verified emails can sign in, since accounts are linked by email */
    emailVerified: z.boolean(),
    avatar_url: z.string().optional(),
    name: z.string().optional(),
});

export type OauthUserInfo = z.infer<typeof OauthUserInfo>;

export type FetchUser = (accessToken: string) => Promise<ResultType<OauthUserInfo>>;
