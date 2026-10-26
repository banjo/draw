import { TRPCError } from "@trpc/server";
import {
    Cause,
    ExcalidrawSimpleElementSchema,
    ExistingSlugSchema,
    Result,
    SlugSchema,
} from "common";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { createContextLogger } from "../../lib/context-logger";
import { DrawRepository } from "../../repositories/draw-repository";

const logger = createContextLogger("draw-router");

export const drawRouter = createTRPCRouter({
    getDrawing: publicProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .query(async ({ input }) => {
            const { slug } = input;
            logger.trace({ slug }, "Getting drawing by slug");
            const drawing = await DrawRepository.getDrawingBySlug(slug);

            if (!drawing.success) {
                logger.error({ slug, message: drawing.message }, "Failed to get drawing");
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: drawing.message,
                    cause: Cause.DRAWING_NOT_FOUND,
                });
            }

            return drawing.data.map(e => e.data);
        }),
    /** Create a new drawing. Existing drawings change through collaboration only. */
    saveDrawing: publicProcedure
        .input(
            z.object({
                slug: SlugSchema,
                elements: ExcalidrawSimpleElementSchema.array(),
                order: z.string().array(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { slug, elements, order } = input;
            logger.trace({ slug }, `Creating drawing`);

            const drawingResult = await DrawRepository.createDrawing(
                slug,
                elements,
                order,
                ctx.userId
            );

            if (!drawingResult.success) {
                logger.error({ slug, message: drawingResult.message }, "Failed to create drawing");
                throw new TRPCError({
                    code: drawingResult.type === "Conflict" ? "CONFLICT" : "INTERNAL_SERVER_ERROR",
                    message: drawingResult.message,
                });
            }

            logger.info({ slug }, "Drawing created");
            return drawingResult.data;
        }),
    saveToCollection: protectedProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .mutation(async ({ input, ctx }) => {
            const { slug } = input;
            const { userId } = ctx;

            logger.trace({ slug }, "Saving drawing to collection");

            if (!userId) {
                logger.error("Unauthorized user");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            const drawingResult = await DrawRepository.saveToCollection(slug, userId);

            if (!drawingResult.success) {
                logger.error(
                    { slug, message: drawingResult.message },
                    "Failed to save drawing to collection"
                );
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: drawingResult.message,
                });
            }

            logger.info({ slug }, "Drawing saved to collection");
            return Result.ok();
        }),
    getCollection: protectedProcedure.query(async ({ ctx }) => {
        const { userId } = ctx;

        if (!userId) {
            logger.error("Unauthorized");
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        logger.trace({ userId }, "Getting collection for user");
        const collection = await DrawRepository.getCollection(userId);

        if (!collection.success) {
            logger.error({ userId }, "Failed to get collection for user");
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        return collection.data;
    }),
    deleteFromCollection: protectedProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .mutation(async ({ input, ctx }) => {
            const { slug } = input;
            const { userId } = ctx;

            if (!userId) {
                logger.error("No userId provided in TRPC context");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            logger.trace({ slug }, "Deleting drawing from collection");
            const collectionResult = await DrawRepository.deleteDrawingFromCollection(userId, slug);

            if (!collectionResult.success) {
                logger.error(
                    { slug, message: collectionResult.message },
                    "Failed to delete drawing from collection"
                );
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: collectionResult.message,
                });
            }

            logger.info({ slug }, "Drawing deleted from collection");
            return Result.ok();
        }),
    updateDrawingName: protectedProcedure
        .input(z.object({ slug: ExistingSlugSchema, name: z.string().max(200) }))
        .mutation(async ({ input, ctx }) => {
            const { slug, name } = input;
            const { userId } = ctx;

            if (!userId) {
                logger.error("Unauthorized user");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            logger.trace({ slug }, "Updating drawing name for drawing");
            const drawingResult = await DrawRepository.updateDrawingName(slug, name, userId);

            if (!drawingResult.success) {
                if (drawingResult.type === "Unauthorized") {
                    logger.error({ slug }, `User not authorized to update drawing`);
                    throw new TRPCError({
                        code: "UNAUTHORIZED",
                        message: "Not owner of drawing",
                        cause: Cause.NOT_OWNER,
                    });
                }

                logger.error(
                    { slug },
                    `Failed to update drawing with slug ${slug} - ${drawingResult.message}`
                );
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
            }

            logger.info({ slug }, "Drawing name updated");
            return Result.ok();
        }),
});
