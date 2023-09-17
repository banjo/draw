import { Result } from "@banjoanton/utils";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHonoInstance } from "..";
import { DrawRepository } from "../repositories/DrawRepository";

export const drawController = createHonoInstance();

const getImagesSchema = z.object({
    imageIds: z.string().array(),
});
const getImages = drawController.post(
    "/images/get",
    zValidator("json", getImagesSchema),
    async c => {
        const { imageIds } = c.req.valid("json");

        const images = await DrawRepository.getImages(imageIds);

        if (!images.success) {
            // TODO: use Result when it works
            return c.jsonT({ success: false, message: images.message });
        }

        return c.jsonT(Result.ok(images.data));
    }
);

type GetImagesRoute = typeof getImages;

const saveImagesSchema = z
    .object({
        data: z.string(),
        id: z.string(),
        mimeType: z.string(),
    })
    .array();
const saveImages = drawController.post("/images", zValidator("json", saveImagesSchema), async c => {
    const files = c.req.valid("json");

    const currentImages = await DrawRepository.getImages(files.map(file => file.id));

    if (!currentImages.success) {
        return c.jsonT({ success: false, message: currentImages.message });
    }

    const existingImages = new Set(currentImages.data.map(image => image.imageId));
    const newImages = files.filter(file => !existingImages.has(file.id));

    const image = await DrawRepository.saveImages(newImages);

    if (!image.success) {
        // TODO: use Result when it works
        return c.jsonT({ success: false, message: image.message });
    }

    return c.jsonT({ success: true });
});
type SaveImageRoute = typeof saveImages;

const getDraw = drawController.get("/draw/:slug", async c => {
    const slug = c.req.param("slug");

    const drawing = await DrawRepository.getDrawingBySlug(slug);

    if (!drawing.success) {
        // TODO: use Result when it works
        return c.jsonT({ success: false, message: drawing.message });
    }

    return c.jsonT(Result.ok(drawing.data.map(e => e.data)));
});
type GetDrawRoute = typeof getDraw;

export const elementSchema = z
    .object({
        id: z.string(),
        version: z.number(),
    })
    .passthrough();

export type ExcalidrawElement = z.infer<typeof elementSchema>;

const saveDrawingSchema = z.object({
    slug: z.string(),
    elements: elementSchema.array(),
    order: z.string().array(),
});
const createDrawing = drawController.post(
    "/draw",
    zValidator("json", saveDrawingSchema),
    async c => {
        const { slug, elements, order } = c.req.valid("json");

        const drawingResult = await DrawRepository.saveDrawing(slug, elements, order);

        if (!drawingResult.success) {
            // TODO: use Result when it works
            return c.jsonT({ success: false, message: drawingResult.message });
        }

        return c.jsonT(Result.ok(drawingResult.data));
    }
);
type CreateDrawingRoute = typeof createDrawing;

export type DrawController = GetDrawRoute | CreateDrawingRoute | SaveImageRoute | GetImagesRoute;
