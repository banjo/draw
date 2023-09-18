import { Result } from "@banjoanton/utils";
import { z } from "zod";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const imageRouter = createTRPCRouter({
    getImages: publicProcedure
        .input(
            z.object({
                imageIds: z.string().array(),
            })
        )
        .query(async ({ input }) => {
            const { imageIds } = input;

            const images = await DrawRepository.getImages(imageIds);

            if (!images.success) {
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
            const currentImages = await DrawRepository.getImages(files.map(file => file.id));

            if (!currentImages.success) {
                return Result.error(currentImages.message, "InternalError");
            }

            const existingImages = new Set(currentImages.data.map(image => image.imageId));
            const newImages = files.filter(file => !existingImages.has(file.id));

            const image = await DrawRepository.saveImages(newImages);

            if (!image.success) {
                return Result.error(image.message, "InternalError");
            }

            return Result.okEmpty();
        }),
});
