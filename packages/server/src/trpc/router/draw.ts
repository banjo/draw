import { Result } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import { Cause, createLogger } from "common";
import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "../../../../common/src/model/excalidraw-simple-element";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const logger = createLogger("DrawRouter");

export const drawRouter = createTRPCRouter({
    getDrawing: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
        const { slug } = input;
        logger.trace(`Getting drawing: ${slug}`);
        const drawing = await DrawRepository.getDrawingBySlug(slug);

        if (!drawing.success) {
            logger.error(`Failed to get drawing: ${slug}`);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: drawing.message });
        }

        return drawing.data.map(e => e.data);
    }),
    saveDrawing: publicProcedure
        .input(
            z.object({
                slug: z.string(),
                elements: ExcalidrawSimpleElementSchema.array(),
                order: z.string().array(),
                userId: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const { slug, elements, order, userId } = input;
            logger.trace(`Saving drawing: ${slug}`);

            const drawingResult = await DrawRepository.saveDrawingFromDeltaUpdate(
                slug,
                elements,
                order,
                userId
            );

            if (!drawingResult.success) {
                logger.error(`Failed to save drawing: ${slug}`);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: drawingResult.message,
                });
            }

            return drawingResult.data;
        }),
    saveToCollection: protectedProcedure
        .input(z.object({ slug: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { slug } = input;
            const { userId } = ctx;

            logger.trace(`Saving drawing to collection: ${slug}`);

            if (!userId) {
                logger.error("Unauthorized");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            const drawingResult = await DrawRepository.saveToCollection(slug, userId);

            if (!drawingResult.success) {
                logger.error(`Failed to save drawing to collection: ${slug}`);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: drawingResult.message,
                });
            }

            return Result.okEmpty();
        }),
    getCollection: protectedProcedure.query(async ({ ctx }) => {
        const { userId } = ctx;

        if (!userId) {
            logger.error("Unauthorized");
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        logger.trace(`Getting collection for user: ${userId}`);
        const collection = await DrawRepository.getCollection(userId);

        if (!collection.success) {
            logger.error(`Failed to get collection for user: ${userId}`);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        return collection.data;
    }),
    deleteFromCollection: protectedProcedure
        .input(z.object({ slug: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { slug } = input;
            const { userId } = ctx;

            if (!userId) {
                logger.error("Unauthorized");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            logger.trace(`Deleting drawing from collection: ${slug}`);
            const collectionResult = await DrawRepository.deleteDrawingFromCollection(userId, slug);

            if (!collectionResult.success) {
                logger.error(`Failed to delete drawing from collection: ${slug}`);
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: collectionResult.message,
                });
            }

            return Result.okEmpty();
        }),
    updateDrawingName: protectedProcedure
        .input(z.object({ slug: z.string(), name: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { slug, name } = input;
            const { userId } = ctx;

            if (!userId) {
                logger.error("Unauthorized");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            logger.trace(`Updating drawing name: ${slug}`);
            const drawingResult = await DrawRepository.updateDrawingName(slug, name, userId);

            if (!drawingResult.success) {
                if (drawingResult.type === "Unauthorized") {
                    logger.error(`User not authorized to update drawing: ${slug}`);
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "Not owner of drawing",
                        cause: Cause.NOT_OWNER,
                    });
                }

                logger.error(`Failed to update drawing name: ${slug}`);
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
            }

            return Result.okEmpty();
        }),
});
