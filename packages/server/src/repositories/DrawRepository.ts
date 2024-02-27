import { isDefined, Maybe, Result } from "@banjoanton/utils";
import { Prisma, prisma } from "db";
import { createLogger } from "utils";
import { ExcalidrawElement } from "../trpc/router/draw";
import { UserRepository } from "./UserRepository";

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

const saveDrawing = async (
    slug: string,
    elements: ExcalidrawElement[],
    order: string[],
    userId?: string
) => {
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

    let ownerId: Maybe<number>;
    if (userId) {
        const userIdResult = await UserRepository.getIdByExternalId(userId);

        if (!userIdResult.success) {
            return Result.error("Error getting user", "InternalError");
        }

        ownerId = userIdResult.data;
    }

    const createNewDrawing = await prisma.drawing.create({
        data: {
            slug,
            order,
            owner: ownerId
                ? {
                      connect: {
                          id: ownerId,
                      },
                  }
                : undefined,
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

const saveToMyDrawings = async (slug: string, userId: number) => {
    const drawing = await prisma.drawing.findUnique({
        where: {
            slug,
        },
    });

    if (!drawing) {
        logger.error(`Drawing not found: ${slug}`);
        return Result.error("Drawing not found", "NotFound");
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        logger.error(`User not found: ${userId}`);
        return Result.error("User not found", "NotFound");
    }

    const saveToMyDrawingsResult = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            savedDrawings: {
                connect: {
                    id: drawing.id,
                },
            },
        },
    });

    if (!saveToMyDrawingsResult) {
        logger.error(`Error saving drawing to user: ${slug}`);
        return Result.error("Error saving drawing to user", "InternalError");
    }

    return Result.okEmpty();
};

const getMyDrawings = async (userId: number) => {
    const drawings = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            savedDrawings: true,
        },
    });

    if (!drawings) {
        logger.error(`Error getting user drawings: ${userId}`);
        return Result.error("Error getting user drawings", "InternalError");
    }

    const mapped = drawings.savedDrawings.map(drawing => ({
        slug: drawing.slug,
        name: drawing.name ?? "untitled",
        isOwner: drawing.ownerId === userId,
    }));

    return Result.ok(mapped);
};

const deleteDrawingFromMyDrawings = async (userId: number, slug: string) => {
    const drawing = await prisma.drawing.findUnique({
        where: {
            slug,
        },
    });

    if (!drawing) {
        logger.error(`Drawing not found: ${slug}`);
        return Result.error("Drawing not found", "NotFound");
    }

    const deleteDrawingResult = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            savedDrawings: {
                disconnect: {
                    id: drawing.id,
                },
            },
        },
    });

    if (!deleteDrawingResult) {
        logger.error(`Error deleting drawing from user: ${slug}`);
        return Result.error("Error deleting drawing from user", "InternalError");
    }

    return Result.okEmpty();
};

const updateDrawingName = async (slug: string, name: string, userId: number) => {
    // only update if the drawings owner id matches the user id
    const drawing = await prisma.drawing.findUnique({
        where: {
            slug,
        },
    });

    if (!drawing) {
        logger.error(`Drawing not found: ${slug}`);
        return Result.error("Drawing not found", "NotFound");
    }

    if (drawing.ownerId !== userId) {
        logger.error(`User not authorized to update drawing: ${slug}`);
        return Result.error("User not authorized to update drawing", "Unauthorized");
    }

    const updateDrawingResult = await prisma.drawing.update({
        where: {
            id: drawing.id,
        },
        data: {
            name,
        },
    });

    if (!updateDrawingResult) {
        logger.error(`Error updating drawing name: ${slug}`);
        return Result.error("Error updating drawing name", "InternalError");
    }

    return Result.okEmpty();
};

export const DrawRepository = {
    getDrawingBySlug,
    saveDrawing,
    saveImages,
    getImages,
    saveToMyDrawings,
    getMyDrawings,
    deleteDrawingFromMyDrawings,
    updateDrawingName,
};
