import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { FileRepository } from "../../repositories/file-repository";
import { BucketService } from "../../services/bucket-service";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createContextLogger("file-router");

const ImageFileSchema = z.object({
    imageId: z.string(),
    mimeType: z.string(),
});

export type ImageFile = z.infer<typeof ImageFileSchema>;

const SaveImageSchema = z.object({
    images: ImageFileSchema.array(),
});

export const fileRouter = createTRPCRouter({
    saveImagesByPresignedUrl: publicProcedure.input(SaveImageSchema).mutation(async ({ input }) => {
        const { images } = input;
        logger.trace({ images }, "Generating presigned URL for images");

        const databaseResult = await FileRepository.savePresignedImageFiles(images);

        if (!databaseResult.success) {
            logger.error({ message: databaseResult.message }, "Failed to save images to database");
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: databaseResult.message });
        }

        const keys = BucketService.createFileImageKeys(images);

        const presignedUrls = await BucketService.generateMultiplePresignedUrlsForWrite(keys);

        if (!presignedUrls.success) {
            logger.error({ message: presignedUrls.message }, "Failed to generate presigned URLs");
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: presignedUrls.message });
        }

        return presignedUrls.data;
    }),
    getPresignedUrlsByImageIds: publicProcedure
        .input(z.object({ imageIds: z.string().array() }))
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
