import { Result } from "@banjoanton/utils";
import { z } from "zod";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, publicProcedure } from "../trpc";

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
});
