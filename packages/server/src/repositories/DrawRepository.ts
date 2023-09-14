import { Prisma, prisma } from "db";
import { Result, createLogger } from "utils";
import { ExcalidrawElement } from "../controller/DrawController";

const logger = createLogger("DrawRepository");

const getDrawingBySlug = async (slug: string) => {
    const drawing = await prisma.drawing.findUnique({
        where: {
            slug,
        },
        include: {
            elements: true,
        },
    });

    if (!drawing) {
        logger.error(`Drawing not found: ${slug}`);
        return Result.error("Drawing not found", "NotFound");
    }

    logger.trace(`Drawing found: ${slug}`);
    return Result.ok(drawing);
};

const saveDrawing = async (slug: string, elements: ExcalidrawElement[]) => {
    const drawingExists = await prisma.drawing.findUnique({
        where: {
            slug,
        },
    });

    if (drawingExists) {
        await Promise.all(
            elements.map(async element => {
                if (element.isDeleted) {
                    await prisma.drawingElement.delete({
                        where: {
                            elementId: element.id,
                        },
                    });
                    return;
                }

                await prisma.drawingElement.upsert({
                    where: {
                        elementId: element.id,
                    },
                    create: {
                        elementId: element.id,
                        data: element as Prisma.InputJsonValue,
                        version: element.version,
                        drawingId: drawingExists.id,
                    },
                    update: {
                        data: element as Prisma.InputJsonValue,
                        version: element.version,
                    },
                });
            })
        );

        return Result.ok(drawingExists.id);
    }

    const createNewDrawing = await prisma.drawing.create({
        data: {
            slug,
            elements: {
                connectOrCreate: elements.map(element => ({
                    where: {
                        elementId: element.id,
                    },
                    create: {
                        data: element as Prisma.InputJsonValue,
                        elementId: element.id,
                        version: element.version,
                    },
                })),
            },
        },
    });

    if (!createNewDrawing) {
        logger.error(`Error saving drawing: ${slug}`);
        return Result.error("Error saving drawing", "InternalError");
    }

    return Result.ok(createNewDrawing.id);
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
