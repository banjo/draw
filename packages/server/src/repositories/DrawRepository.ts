import { Prisma, prisma } from "db";
import { Result, createLogger } from "utils";

const logger = createLogger("DrawRepository");

const getDrawingBySlug = async (slug: string) => {
    const drawing = await prisma.drawing.findUnique({
        where: {
            slug,
        },
    });

    if (!drawing) {
        logger.error(`Drawing not found: ${slug}`);
        return Result.error("Drawing not found", "NotFound");
    }

    logger.trace(`Drawing found: ${slug}`);
    return Result.ok(drawing);
};

const saveDrawing = async (slug: string, elements: Prisma.JsonObject[]) => {
    const drawing = await prisma.drawing.upsert({
        where: {
            slug,
        },
        create: {
            slug,
            data: elements,
        },
        update: {
            data: elements,
        },
    });

    if (!drawing) {
        logger.error(`Error saving drawing: ${slug}`);
        return Result.error("Error saving drawing", "InternalError");
    }

    return Result.ok(drawing.id);
};

const saveImages = async (images: { data: string; id: string; mimeType: string }[]) => {
    const imagesResponse = await prisma.image.createMany({
        data: images.map(image => ({
            data: image.data,
            imageId: image.id,
            mimeType: image.mimeType,
        })),
    });

    if (!imagesResponse) {
        logger.error(`Error saving images`);
        return Result.error("Error saving images", "InternalError");
    }

    return Result.okEmpty();
};

const getImages = async (imageIds: string[]) => {
    const images = await prisma.image.findMany({
        where: {
            imageId: {
                in: imageIds,
            },
        },
    });

    if (!images) {
        logger.error(`Error getting images`);
        return Result.error("Error getting images", "InternalError");
    }

    return Result.ok(images);
};

export const DrawRepository = {
    getDrawingBySlug,
    saveDrawing,
    saveImages,
    getImages,
};
