import { isDefined } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import { ImageIdSchema, ImageUploadSchema } from "common";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { BucketKey } from "../../model/bucket/bucket-key";
import { FileRepository } from "../../repositories/file-repository";
import { BucketService } from "../../services/bucket-service";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createContextLogger("file-router");

export const fileRouter = createTRPCRouter({
    /**
     * Upload URLs for images that aren't in the bucket yet. Uploaded images can't be replaced,
     * as their ids are in the drawing data that everyone on it can see.
     */
    saveImagesByPresignedUrl: publicProcedure
        .input(z.object({ images: ImageUploadSchema.array().max(50) }))
        .mutation(async ({ input }) => {
            const { images } = input;
            logger.trace({ images }, "Generating presigned URL for images");

            const claimed = await FileRepository.claimImages(images);

            if (!claimed.success) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: claimed.message });
            }

            const requested = new Map(images.map(image => [image.imageId, image]));
            const added = claimed.data.added.map(({ imageId, mimeType, size }) => ({
                key: BucketKey.from(imageId, mimeType),
                mimeType,
                size,
            }));

            // A row without an object is an upload that never finished, which can be retried
            const unfinished = await Promise.all(
                claimed.data.existing.map(async row => {
                    const image = requested.get(row.imageId);
                    if (!image || image.mimeType !== row.mimeType) return undefined;
                    if (await BucketService.objectExists(row.key)) return undefined;
                    return { key: row.key, mimeType: row.mimeType, size: image.size };
                })
            );

            const presignedUrls = await BucketService.generateMultiplePresignedUrlsForWrite([
                ...added,
                ...unfinished.filter(isDefined),
            ]);

            if (!presignedUrls.success) {
                logger.error(
                    { message: presignedUrls.message },
                    "Failed to generate presigned URLs"
                );
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Could not prepare the image upload",
                });
            }

            return presignedUrls.data;
        }),
    getPresignedUrlsByImageIds: publicProcedure
        .input(z.object({ imageIds: ImageIdSchema.array().max(1000) }))
        .query(async ({ input }) => {
            const { imageIds } = input;
            logger.trace({ imageIds }, "Getting presigned URLs for images");

            const imagesResult = await FileRepository.fetchImagesByImageIds(imageIds);

            if (!imagesResult.success) {
                logger.error(
                    { message: imagesResult.message },
                    "Failed to fetch images from database"
                );
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: imagesResult.message,
                });
            }

            const presignedUrls = await BucketService.generateMultiplePresignedUrlsForRead(
                imagesResult.data.map(image => image.key)
            );

            if (!presignedUrls.success) {
                logger.error(
                    { message: presignedUrls.message },
                    "Failed to generate presigned URLs"
                );
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: presignedUrls.message,
                });
            }

            const imageResultDto = imagesResult.data.map(image => {
                const urlResult = presignedUrls.data.find(url => url.key === image.key);

                if (!urlResult) {
                    logger.error({ key: image.key }, "Presigned URL not found for image key");
                    // TODO: does this work??
                    throw new TRPCError({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Presigned URL not found for image key",
                    });
                }

                return {
                    mimeType: image.mimeType,
                    imageId: image.imageId,
                    presignedUrl: urlResult.presignedUrl,
                };
            });

            return imageResultDto;
        }),
});
