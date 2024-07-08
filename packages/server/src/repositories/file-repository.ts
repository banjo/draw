import { Result, wrapAsync } from "@banjoanton/utils";
import { createContextLogger } from "../lib/context-logger";
import { prisma } from "db";
import { Env } from "common";
import { BucketKey } from "../model/bucket/bucket-key";
import { ImageFile } from "../trpc/router/file";

const logger = createContextLogger("file-repository");
const env = Env.server();

const savePresignedImageFiles = async (imageFile: ImageFile[]) => {
    logger.trace({ imageFile }, "Saving bucket images to database");

    const [existingFiles, findError] = await wrapAsync(async () => {
        const files = await prisma.bucketFile.findMany({
            where: {
                imageId: {
                    in: imageFile.map(({ imageId }) => imageId),
                },
            },
            select: {
                imageId: true,
            },
        });

        return files;
    });

    if (findError) {
        logger.error({ error: findError }, "Failed to fetch existing files from database");
        return Result.error(findError.message, "InternalError");
    }

    const imageIdsToSave = imageFile.filter(
        ({ imageId }) => !existingFiles.some(file => file.imageId === imageId)
    );

    const [count, error] = await wrapAsync(async () => {
        const result = await prisma.bucketFile.createMany({
            data: imageIdsToSave.map(({ mimeType, imageId }) => {
                const key = BucketKey.from(imageId, mimeType);
                return {
                    imageId,
                    bucket: env.CLOUDFLARE_BUCKET_NAME,
                    key,
                    mimeType,
                };
            }),
        });

        return result.count;
    });

    if (error) {
        logger.error({ error }, "Failed to save bucket image to database");
        return Result.error(error.message, "InternalError");
    }

    return Result.ok(count);
};

const fetchImagesByImageIds = async (imageIds: string[]) => {
    logger.trace({ imageIds }, "Fetching images by imageIds");

    const [images, error] = await wrapAsync(async () =>
        prisma.bucketFile.findMany({
            where: {
                imageId: {
                    in: imageIds,
                },
            },
        })
    );

    if (error) {
        logger.error({ error }, "Failed to fetch images by imageIds");
        return Result.error(error.message, "InternalError");
    }

    return Result.ok(images);
};

export const FileRepository = { savePresignedImageFiles, fetchImagesByImageIds };
