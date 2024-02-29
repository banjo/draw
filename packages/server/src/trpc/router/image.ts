import { Result } from "@banjoanton/utils";
import { createLogger } from "utils";
import { z } from "zod";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createLogger("ImageRouter");

export const imageRouter = createTRPCRouter({
    getImages: publicProcedure
        .input(
            z.object({
                imageIds: z.string().array(),
            })
        )
        .query(async ({ input }) => {
            const { imageIds } = input;

            logger.info(`Getting images: ${imageIds.join(", ")}`);

            const images = await DrawRepository.getImages(imageIds);

            if (!images.success) {
                logger.error(`Failed to get images: ${imageIds.join(", ")}`);
                return Result.error(images.message, "InternalError");
            }

            return Result.ok(images.data);
        }),
    saveImages: publicProcedure
        .input(
            z
                .object({
                    data: z.string(),
                    id: z.string(),
                    mimeType: z.string(),
                })
                .array()
        )
        .mutation(async ({ input: files }) => {
            logger.info(`Saving images: ${files.map(file => file.id).join(", ")}`);
            const currentImages = await DrawRepository.getImages(files.map(file => file.id));

            if (!currentImages.success) {
                logger.error(
                    `Failed to get images to compare: ${files.map(file => file.id).join(", ")}`
                );
                return Result.error(currentImages.message, "InternalError");
            }

            const existingImages = new Set(currentImages.data.map(image => image.imageId));
            const newImages = files.filter(file => !existingImages.has(file.id));

            const image = await DrawRepository.saveImages(newImages);

            if (!image.success) {
                logger.error(`Failed to save images: ${newImages.map(file => file.id).join(", ")}`);
                return Result.error(image.message, "InternalError");
            }

            return Result.okEmpty();
        }),
});
