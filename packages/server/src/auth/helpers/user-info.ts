import { ResultType } from "@banjoanton/utils";
import { z } from "zod";

export const OauthUserInfo = z.object({
    id: z.number(),
    email: z.string(),
    avatar_url: z.string().optional(),
    name: z.string().optional(),
});

export type OauthUserInfo = z.infer<typeof OauthUserInfo>;

export type FetchUser = (accessToken: string) => Promise<ResultType<OauthUserInfo>>;
