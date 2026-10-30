import { TRPCError } from "@trpc/server";
import {
    Cause,
    ExcalidrawSimpleElement,
    ExcalidrawSimpleElementSchema,
    ExistingSlugSchema,
    MAX_ELEMENTS,
    Result,
    SlugSchema,
} from "common";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { createContextLogger } from "../../lib/context-logger";
import { drawingEmitter } from "../../model/emitters";
import { DrawRepository } from "../../repositories/draw-repository";
import { requireAccess } from "../require-access";

const logger = createContextLogger("draw-router");

const MAX_NAME_LENGTH = 200;

/** The latest elements of a drawing: from memory when it's open, as that has unsaved changes */
const getLatestElements = async (slug: string) => {
    const board = drawingEmitter.getBoard(slug);
    if (board) return board.elements;

    const drawing = await DrawRepository.getDrawingBySlug(slug);
    if (!drawing.success) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: drawing.message,
            cause: Cause.DRAWING_NOT_FOUND,
        });
    }
    return drawing.data.map(row => ExcalidrawSimpleElement.from(row.data));
};

export const drawRouter = createTRPCRouter({
    getDrawing: publicProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .query(async ({ input, ctx }) => {
            const { slug } = input;
            logger.trace({ slug }, "Getting drawing by slug");
            await requireAccess(slug, ctx.userId, "view");
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
                elements: ExcalidrawSimpleElementSchema.array().max(MAX_ELEMENTS),
                order: z.string().array().max(MAX_ELEMENTS),
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
    updateDrawingName: protectedProcedure
        .input(z.object({ slug: ExistingSlugSchema, name: z.string().max(MAX_NAME_LENGTH) }))
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
                        code: "FORBIDDEN",
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
    /** A private copy of a drawing that's yours, in your collection. Returns the copy's slug. */
    copyToCollection: protectedProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .mutation(async ({ input, ctx }) => {
            const { slug } = input;
            const { userId } = ctx.session;
            await requireAccess(slug, userId, "view");

            const [elements, name] = await Promise.all([
                getLatestElements(slug),
                DrawRepository.getDrawingName(slug),
            ]);
            const copyName = `Copy of ${(name.success && name.data) || "Untitled"}`.slice(
                0,
                MAX_NAME_LENGTH
            );

            const copy = await DrawRepository.createCopy({
                elements,
                name: copyName,
                ownerId: userId,
            });

            if (!copy.success) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: copy.message });
            }

            logger.info({ slug, copy: copy.data }, "Drawing copied");
            return { slug: copy.data };
        }),
});
