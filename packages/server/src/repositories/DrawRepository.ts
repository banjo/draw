import { isDefined, Result } from "@banjoanton/utils";
import { Prisma, prisma } from "db";
import { createLogger } from "utils";
import { ExcalidrawElement } from "../trpc/router/draw";

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

    const orderedElements = drawing.order
        .map(id => {
            const element = drawing.elements.find(e => e.elementId === id);
            if (!element) {
                logger.error(`Element not found: ${id}`);
                return;
            }

            return element;
        })
        // eslint-disable-next-line unicorn/no-array-callback-reference
        .filter(isDefined);

    logger.trace(`Drawing found: ${slug}`);
    return Result.ok(orderedElements);
};

const saveDrawing = async (slug: string, elements: ExcalidrawElement[], order: string[]) => {
    const drawingExists = await prisma.drawing.findUnique({
        where: {
            slug,
        },
    });

    if (drawingExists) {
        const deleteAll = await prisma.drawingElement.deleteMany({
            where: {
                elementId: {
                    in: elements.map(element => element.id),
                },
            },
        });

        if (!deleteAll) {
            logger.error(`Error deleting drawing elements: ${slug}`);
            return Result.error("Error deleting drawing elements", "InternalError");
        }

        const toUpdate = elements.filter(element => !element.isDeleted);

        const update = await prisma.drawingElement.createMany({
            data: toUpdate.map(element => ({
                data: element as Prisma.InputJsonValue,
                elementId: element.id,
                version: element.version,
                drawingId: drawingExists.id,
            })),
        });

        if (!update) {
            logger.error(`Error saving drawing elements: ${slug}`);
            return Result.error("Error saving drawing elements", "InternalError");
        }

        const orderUpdate = await prisma.drawing.update({
            where: {
                id: drawingExists.id,
            },
            data: {
                order,
            },
        });

        if (!orderUpdate) {
            logger.error(`Error saving drawing order: ${slug}`);
            return Result.error("Error saving drawing order", "InternalError");
        }

        return Result.ok(drawingExists.id);
    }

    const createNewDrawing = await prisma.drawing.create({
        data: {
            slug,
            order,
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
