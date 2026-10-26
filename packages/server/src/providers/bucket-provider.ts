import { S3Client } from "@aws-sdk/client-s3";
import { Env } from "common";

const env = Env.server();

const ENDPOINT =
    env.CLOUDFLARE_ENDPOINT ?? `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const S3 = new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    // A local endpoint has no bucket subdomains, so put the bucket in the path
    forcePathStyle: Boolean(env.CLOUDFLARE_ENDPOINT),
    credentials: {
        accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
});
