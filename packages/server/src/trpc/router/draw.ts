import { Result } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import { Cause } from "common";
import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "../../../../common/src/model/excalidraw-simple-element";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { createContextLogger } from "../../lib/context-logger";

const logger = createContextLogger("draw-router");

export const drawRouter = createTRPCRouter({
    getDrawing: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
        const { slug } = input;
        logger.trace(`Getting drawing with slug ${slug}`);
        const drawing = await DrawRepository.getDrawingBySlug(slug);

        if (!drawing.success) {
            logger.error(`Failed to get drawing with slug ${slug} - ${drawing.message}`);
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
            logger.trace(`Saving drawing with slug ${slug}`);

            const drawingResult = await DrawRepository.saveDrawingFromDeltaUpdate(
                slug,
                elements,
                order,
                userId
            );

            if (!drawingResult.success) {
                logger.error(`Failed to save drawing with slug ${slug} - ${drawingResult.message}`);
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

            logger.trace(`Saving drawing to collection with slug ${slug}`);

            if (!userId) {
                logger.error("Unauthorized user");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            const drawingResult = await DrawRepository.saveToCollection(slug, userId);

            if (!drawingResult.success) {
                logger.error(
                    `Failed to save drawing to collection with slug ${slug} - ${drawingResult.message}`
                );
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

        logger.trace(`Getting collection for user with id ${userId}`);
        const collection = await DrawRepository.getCollection(userId);

        if (!collection.success) {
            logger.error(`Failed to get collection for user with ${userId}`);
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
                logger.error("No userId provided in TRPC context");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            logger.trace(`Deleting drawing with slug ${slug} from collection`);
            const collectionResult = await DrawRepository.deleteDrawingFromCollection(userId, slug);

            if (!collectionResult.success) {
                logger.error(
                    `Failed to delete drawing from collection with slug ${slug} - ${collectionResult.message}`
                );
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
                logger.error("No userId provided in TRPC context");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            logger.trace(`Updating drawing name for drawing with slug ${slug}`);
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

            return Result.okEmpty();
        }),
});
