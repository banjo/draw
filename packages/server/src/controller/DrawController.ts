import { zValidator } from "@hono/zod-validator";
import { Result } from "utils";
import { z } from "zod";
import { createHonoInstance } from "..";
import { DrawRepository } from "../repositories/DrawRepository";

export const drawController = createHonoInstance();

const getDraw = drawController.get("/draw/:slug", async c => {
    const slug = c.req.param("slug");

    const drawing = await DrawRepository.getDrawingBySlug(slug);

    if (!drawing.success) {
        // TODO: use Result when it works
        return c.jsonT({ success: false, message: drawing.message });
    }

    return c.jsonT(Result.ok(drawing.data));
});
type GetDrawRoute = typeof getDraw;

const saveDrawingSchema = z.object({
    slug: z.string(),
    elements: z.any().array(),
});
const createDrawing = drawController.post(
    "/draw",
    zValidator("json", saveDrawingSchema),
    async c => {
        const { slug, elements } = c.req.valid("json");

        const drawingResult = await DrawRepository.saveDrawing(slug, elements);

        if (!drawingResult.success) {
            // TODO: use Result when it works
            return c.jsonT({ success: false, message: drawingResult.message });
        }

        return c.jsonT(Result.ok(drawingResult.data));
    }
);
type CreateDrawingRoute = typeof createDrawing;

export type DrawController = GetDrawRoute | CreateDrawingRoute;
