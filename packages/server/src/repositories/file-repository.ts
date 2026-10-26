import { wrapAsync } from "@banjoanton/utils";
import { createContextLogger } from "../lib/context-logger";
import { prisma } from "db";
import { Env, ImageUpload, Result } from "common";
import { BucketKey } from "../model/bucket/bucket-key";

const logger = createContextLogger("file-repository");
const env = Env.server();

/**
 * Add rows for images that aren't in the database yet. Returns the rows that already existed
 * and the images that were added, so only new images get an upload URL.
 */
const claimImages = async (images: ImageUpload[]) => {
    logger.trace({ images }, "Claiming images");

    const [result, error] = await wrapAsync(async () => {
        const existing = await prisma.bucketFile.findMany({
            where: { imageId: { in: images.map(({ imageId }) => imageId) } },
        });
        const existingIds = new Set(existing.map(file => file.imageId));
        const added = images.filter(({ imageId }) => !existingIds.has(imageId));

        // The unique imageId skips rows another request added in the meantime
        await prisma.bucketFile.createMany({
            data: added.map(({ mimeType, imageId }) => ({
                imageId,
                bucket: env.CLOUDFLARE_BUCKET_NAME,
                key: BucketKey.from(imageId, mimeType),
                mimeType,
            })),
            skipDuplicates: true,
        });

        return { existing, added };
    });

    if (error) {
        logger.error({ error }, "Failed to claim images");
        return Result.error("Could not save images");
    }

    return Result.ok(result);
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
        return Result.error("Could not fetch images");
    }

    return Result.ok(images);
};

export const FileRepository = { claimImages, fetchImagesByImageIds };
