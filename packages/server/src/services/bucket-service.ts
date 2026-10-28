import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { toSeconds, wrapAsync } from "@banjoanton/utils";
import { createLogger, Env, Result } from "common";
import { S3 } from "../providers/bucket-provider";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PresignedUrlResult } from "../model/bucket/presigned-url-result";

const env = Env.server();
const logger = createLogger("bucket-service");

const BUCKET_NAME = env.CLOUDFLARE_BUCKET_NAME;
const EXPIRE_TIME_SECONDS = toSeconds({ minutes: 1 });

const addFile = async (file: Buffer, key: string, mimeType: string) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: mimeType,
    });

    const [_, error] = await wrapAsync(() => S3.send(command));

    if (error) {
        logger.error({ error }, "Could not add file");
        return Result.error(error.message);
    }

    return Result.ok();
};

type ImageToUpload = {
    key: string;
    mimeType: string;
    /** Bytes. The upload must be exactly this size. */
    size: number;
};

const generatePresignedUrlForWrite = async ({ key, mimeType, size }: ImageToUpload) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: mimeType,
        ContentLength: size,
    });

    // Signing the type and size makes the bucket reject any other upload with this URL
    const [url, error] = await wrapAsync(() =>
        getSignedUrl(S3, command, {
            expiresIn: EXPIRE_TIME_SECONDS,
            signableHeaders: new Set(["content-type", "content-length"]),
        })
    );

    if (error) {
        logger.error({ error }, "Could not generate presigned URL");
        return Result.error(error.message);
    }

    return Result.ok(PresignedUrlResult.from(url, key));
};

const generateMultiplePresignedUrlsForWrite = async (images: ImageToUpload[]) => {
    const allResults = await Promise.all(images.map(generatePresignedUrlForWrite));

    const errors = allResults.filter(result => !result.success);

    if (errors.length > 0) {
        logger.error({ keys: images.map(i => i.key) }, "Could not generate presigned URLs");
        return Result.error("Could not generate multiple presigned URLs");
    }

    const urls = allResults.filter(result => result.success).map(result => result.data);
    return Result.ok(urls);
};

const objectExists = async (key: string) => {
    const [_, error] = await wrapAsync(() =>
        S3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    );

    if (!error) return true;
    if (
        error.name === "NotFound" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
    ) {
        return false;
    }

    // Unknown, so treat it as existing and don't allow an upload over it
    logger.error({ error, key }, "Could not check if object exists");
    return true;
};

const generatePresignedUrlForRead = async (key: string) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    const [url, error] = await wrapAsync(() =>
        getSignedUrl(S3, command, { expiresIn: EXPIRE_TIME_SECONDS })
    );

    if (error) {
        logger.error({ error }, "Could not generate presigned URL");
        return Result.error(error.message);
    }

    const result = PresignedUrlResult.from(url, key);
    return Result.ok(result);
};

const generateMultiplePresignedUrlsForRead = async (keys: string[]) => {
    const allResults = await Promise.all(
        keys.map(async key => await generatePresignedUrlForRead(key))
    );

    const errors = allResults.filter(result => !result.success);

    if (errors.length > 0) {
        logger.error({ keys }, "Could not generate presigned URLs for multiple keys");
        return Result.error("Could not generate multiple presigned URLs");
    }

    const successResults = allResults.filter(result => result.success);
    const presignedUrlResults = successResults.map(result => result.data);
    return Result.ok(presignedUrlResults);
};

export const BucketService = {
    addFile,
    generatePresignedUrlForRead,
    generatePresignedUrlForWrite,
    objectExists,
    generateMultiplePresignedUrlsForWrite,
    generateMultiplePresignedUrlsForRead,
};
