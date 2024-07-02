import { isDefined, Maybe, Result } from "@banjoanton/utils";
import { Board, ExcalidrawSimpleElement } from "common";
import { Prisma, prisma } from "db";
import { createContextLogger } from "../lib/context-logger";

const logger = createContextLogger("draw-repository");

const getDrawingBySlug = async (slug: string) => {
    try {
        const drawing = await prisma.drawing.findUnique({
            where: {
                slug,
            },
            include: {
                elements: true,
            },
        });

        if (!drawing) {
            logger.error({ slug }, `Drawing with slug ${slug} not found`);
            return Result.error("Drawing not found", "NotFound");
        }

        const orderedElements = drawing.order
            .map(id => {
                const element = drawing.elements.find(e => e.elementId === id);
                if (!element) {
                    logger.error({ id }, `Element with id ${id} not found`);
                    return undefined;
                }

                return element;
            })
            .filter(isDefined);

        logger.trace(`Drawing found: ${slug}`);
        return Result.ok(orderedElements);
    } catch (error) {
        logger.error({ error }, `Error getting drawing with slug ${slug}`);
        return Result.error("Error getting drawing", "InternalError");
    }
};

// TODO: implement a better way to save the drawing (does this even work?)
const saveDrawingFromBoard = async (slug: string, board: Board) => {
    try {
        return await prisma.$transaction(async tx => {
            const drawing = await tx.drawing.findUnique({
                where: {
                    slug,
                },
            });

            const order = board.elements.map(element => element.id.toString());

            if (drawing) {
                const deleteAll = await tx.drawingElement.deleteMany({
                    where: {
                        drawingId: drawing.id,
                    },
                });

                if (!deleteAll) {
                    logger.error(`Error deleting drawing elements with slug ${slug}`);
                    return Result.error("Error deleting drawing elements", "InternalError");
                }

                const createNewDrawingElements = await tx.drawingElement.createMany({
                    data: board.elements.map(element => ({
                        data: element as Prisma.InputJsonValue,
                        elementId: element.id.toString(),
                        version: element.version,
                        drawingId: drawing.id,
                    })),
                });

                if (!createNewDrawingElements) {
                    logger.error(`Error saving drawing elements: ${slug}`);
                    return Result.error("Error saving drawing elements", "InternalError");
                }

                const orderUpdate = await tx.drawing.update({
                    where: {
                        id: drawing.id,
                    },
                    data: {
                        order,
                    },
                });

                if (!orderUpdate) {
                    logger.error(`Error saving drawing order: ${slug}`);
                    return Result.error("Error saving drawing order", "InternalError");
                }

                return Result.ok(drawing.id);
            }

            const createNewDrawing = await prisma.drawing.create({
                data: {
                    slug,
                    elements: {
                        create: board.elements.map(element => ({
                            data: element as Prisma.InputJsonValue,
                            elementId: element.id.toString(),
                            version: element.version,
                        })),
                    },
                    order,
                },
            });

            if (!createNewDrawing) {
                logger.error(`Error saving drawing: ${slug}`);
                return Result.error("Error saving drawing", "InternalError");
            }

            return Result.ok(createNewDrawing.id);
        });
    } catch (error) {
        logger.error({ error, slug }, `Error saving drawing: ${slug}`);
        return Result.error("Error saving drawing", "InternalError");
    }
};

const saveDrawingFromDeltaUpdate = async (
    slug: string,
    elements: ExcalidrawSimpleElement[],
    order: string[],
    userId?: number
) => {
    // TODO: wrap in transaction
    try {
        const drawingExists = await prisma.drawing.findUnique({
            where: {
                slug,
            },
        });

        if (drawingExists) {
            const deleteAll = await prisma.drawingElement.deleteMany({
                where: {
                    elementId: {
                        in: elements.map(element => element.id.toString()),
                    },
                    drawing: {
                        slug,
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
                    elementId: element.id.toString(),
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
                owner: userId
                    ? {
                          connect: {
                              id: userId,
                          },
                      }
                    : undefined,
            },
        });

        if (!createNewDrawing) {
            logger.error(`Error saving drawing: ${slug}`);
            return Result.error("Error saving drawing", "InternalError");
        }

        const createNewDrawingElements = await prisma.drawingElement.createMany({
            data: elements.map(element => ({
                data: element as Prisma.InputJsonValue,
                elementId: element.id.toString(),
                version: element.version,
                drawingId: createNewDrawing.id,
            })),
        });

        if (!createNewDrawingElements) {
            logger.error(`Error saving drawing elements: ${slug}`);
            return Result.error("Error saving drawing elements", "InternalError");
        }

        return Result.ok(createNewDrawing.id);
    } catch (error) {
        logger.error({ error, slug }, `Error saving drawing: ${slug}`);
        return Result.error("Error saving drawing", "InternalError");
    }
};

const saveImages = async (images: { data: string; id: string; mimeType: string }[]) => {
    try {
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
    } catch (error) {
        logger.error({ error }, `Error saving images`);
        return Result.error("Error saving images", "InternalError");
    }
};

const getImages = async (imageIds: string[]) => {
    try {
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
    } catch (error) {
        logger.error({ error }, `Error getting images`);
        return Result.error("Error getting images", "InternalError");
    }
};

const saveToCollection = async (slug: string, userId: number) => {
    try {
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

        const saveToCollectionResult = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                collection: {
                    connect: {
                        id: drawing.id,
                    },
                },
            },
        });

        if (!saveToCollectionResult) {
            logger.error(`Error saving drawing to user: ${slug}`);
            return Result.error("Error saving drawing to user", "InternalError");
        }

        return Result.okEmpty();
    } catch (error) {
        logger.error({ error, slug, userId }, `Error saving drawing to user`);
        return Result.error("Error saving drawing to user", "InternalError");
    }
};

const getCollection = async (userId: number) => {
    try {
        const collection = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            include: {
                collection: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });

        if (!collection) {
            logger.error(`Error getting user collection: ${userId}`);
            return Result.error("Error getting user collection", "InternalError");
        }

        const mapped = collection.collection.map(drawing => ({
            slug: drawing.slug,
            name: drawing.name ?? "untitled",
            isOwner: drawing.ownerId === userId,
        }));

        return Result.ok(mapped);
    } catch (error) {
        logger.error({ error, userId }, `Error getting user collection for user ${userId}`);
        return Result.error("Error getting user collection", "InternalError");
    }
};

const deleteDrawingFromCollection = async (userId: number, slug: string) => {
    try {
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
                collection: {
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
    } catch (error) {
        logger.error({ error, slug }, `Error deleting drawing from user: ${slug}`);
        return Result.error("Error deleting drawing from user", "InternalError");
    }
};

const updateDrawingName = async (slug: string, name: string, userId: number) => {
    try {
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
    } catch (error) {
        logger.error({ error, slug }, `Error updating drawing name: ${slug}`);
        return Result.error("Error updating drawing name", "InternalError");
    }
};

export const DrawRepository = {
    getDrawingBySlug,
    saveDrawingFromDeltaUpdate,
    saveDrawingFromBoard,
    saveImages,
    getImages,
    saveToCollection,
    getCollection,
    deleteDrawingFromCollection,
    updateDrawingName,
};
