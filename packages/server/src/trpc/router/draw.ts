import { Result } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const elementSchema = z
    .object({
        id: z.string(),
        version: z.number(),
    })
    .passthrough();

export type ExcalidrawElement = z.infer<typeof elementSchema>;

export const drawRouter = createTRPCRouter({
    getDrawing: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
        const { slug } = input;
        const drawing = await DrawRepository.getDrawingBySlug(slug);

        if (!drawing.success) {
            return Result.error(drawing.message, "InternalError");
        }

        return Result.ok(drawing.data.map(e => e.data));
    }),
    saveDrawing: publicProcedure
        .input(
            z.object({
                slug: z.string(),
                elements: elementSchema.array(),
                order: z.string().array(),
                userId: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const { slug, elements, order, userId } = input;

            const drawingResult = await DrawRepository.saveDrawing(slug, elements, order, userId);

            if (!drawingResult.success) {
                return Result.error(drawingResult.message, "InternalError");
            }

            return Result.ok(drawingResult.data);
        }),
    saveToCollection: protectedProcedure
        .input(z.object({ slug: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { slug } = input;
            const { userId } = ctx;

            if (!userId) {
                return Result.error("Unauthorized", "Unauthorized");
            }

            const drawingResult = await DrawRepository.saveToCollection(slug, userId);

            if (!drawingResult.success) {
                return Result.error(drawingResult.message, "InternalError");
            }

            return Result.okEmpty();
        }),
    getCollection: protectedProcedure.query(async ({ ctx }) => {
        const { userId } = ctx;

        if (!userId) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const collection = await DrawRepository.getCollection(userId);

        if (!collection.success) {
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
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            const collectionResult = await DrawRepository.deleteDrawingFromCollection(userId, slug);

            if (!collectionResult.success) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
            }

            return Result.okEmpty();
        }),
    updateDrawingName: protectedProcedure
        .input(z.object({ slug: z.string(), name: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { slug, name } = input;
            const { userId } = ctx;

            if (!userId) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            const drawingResult = await DrawRepository.updateDrawingName(slug, name, userId);

            if (!drawingResult.success) {
                if (drawingResult.type === "Unauthorized") {
                    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not owner of drawing" });
                }

                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
            }

            return Result.okEmpty();
        }),
});
