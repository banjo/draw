import {
    GetObjectCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { toSeconds, wrapAsync } from "@banjoanton/utils";
import { createLogger, Env, Result } from "common";
import { S3 } from "../providers/bucket-provider";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PresignedUrlResult } from "../model/bucket/presigned-url-result";
import { Bucket } from "../model/bucket/bucket";
import { BucketFile } from "../model/bucket/bucket-file";
import { BucketKey } from "../model/bucket/bucket-key";
import { ImageFile } from "../trpc/router/file";

const env = Env.server();
const logger = createLogger("bucket-service");

const BUCKET_NAME = env.CLOUDFLARE_BUCKET_NAME;
const EXPIRE_TIME_SECONDS = toSeconds({ minutes: 1 });

const listAllBuckets = async () => {
    const command = new ListBucketsCommand();

    const [response, error] = await wrapAsync(() => S3.send(command));

    if (error) {
        logger.error({ error }, "Could not list buckets");
        return Result.error(error.message);
    }

    if (!response.Buckets) {
        logger.error("No buckets found");
        return Result.ok([]);
    }

    const buckets = response.Buckets.map(Bucket.fromAwsBucket);

    return Result.ok(buckets);
};

const listAllFiles = async () => {
    const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });

    const [response, error] = await wrapAsync(() => S3.send(command));

    if (error) {
        logger.error({ error }, "Could not list buckets");
        return Result.error(error.message);
    }

    if (!response.Contents) {
        logger.trace("No files found");
        return Result.ok([]);
    }

    const files = response.Contents.map(BucketFile.fromAwsContent);

    return Result.ok(files);
};

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

const generatePresignedUrlForWrite = async (key: string) => {
    const command = new PutObjectCommand({
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

    // TODO: public url for cloudflare bucket
    const publicUrl = `http://TODO.se`;

    const result = PresignedUrlResult.from(url, key);
    return Result.ok(result);
};

const generateMultiplePresignedUrlsForWrite = async (keys: string[]) => {
    const allResults = await Promise.all(
        keys.map(async key => await generatePresignedUrlForWrite(key))
    );

    const errors = allResults.filter(result => !result.success);

    if (errors.length > 0) {
        logger.error({ keys }, "Could not generate presigned URLs for multiple keys");
        return Result.error("Could not generate multiple presigned URLs");
    }

    // TODO: make partition better
    const successResults = allResults.filter(result => result.success);
    const urls = successResults.map(result => result.data);
    return Result.ok(urls);
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

const createFileImageKeys = (images: ImageFile[]) =>
    images.map(({ imageId, mimeType }) => BucketKey.from(imageId, mimeType));

export const BucketService = {
    listAllBuckets,
    listAllFiles,
    addFile,
    generatePresignedUrlForRead,
    generatePresignedUrlForWrite,
    createFileImageKeys,
    generateMultiplePresignedUrlsForWrite,
    generateMultiplePresignedUrlsForRead,
};
