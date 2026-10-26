import { isDefined } from "@banjoanton/utils";
import { Board, ExcalidrawSimpleElement, Result } from "common";
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
            return Result.error("Drawing not found");
        }

        const elementsById = new Map(drawing.elements.map(e => [e.elementId, e]));
        const orderedElements = drawing.order
            .map(id => {
                const element = elementsById.get(id);
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
        return Result.error("Error getting drawing");
    }
};

/** Replace the elements and order of a drawing with the board, in one transaction. */
const saveDrawingFromBoard = async (slug: string, board: Board) => {
    const order = board.elements.map(element => element.id.toString());
    const rows = board.elements.map(element => ({
        data: element as Prisma.InputJsonValue,
        elementId: element.id.toString(),
        version: element.version,
    }));

    try {
        const drawingId = await prisma.$transaction(async tx => {
            const drawing = await tx.drawing.findUnique({ where: { slug } });

            if (drawing) {
                await tx.drawingElement.deleteMany({ where: { drawingId: drawing.id } });
                await tx.drawingElement.createMany({
                    data: rows.map(row => ({ ...row, drawingId: drawing.id })),
                });
                await tx.drawing.update({ where: { id: drawing.id }, data: { order } });

                return drawing.id;
            }

            const created = await tx.drawing.create({
                data: { slug, order, elements: { create: rows } },
            });

            return created.id;
        });

        return Result.ok(drawingId);
    } catch (error) {
        logger.error({ error, slug }, `Error saving drawing: ${slug}`);
        return Result.error("Error saving drawing");
    }
};

const saveDrawingFromDeltaUpdate = async (
    slug: string,
    elements: ExcalidrawSimpleElement[],
    order: string[],
    userId?: number
) => {
    // Deleted elements only matter for collaboration, not when saving a drawing from scratch
    const toSave = elements.filter(element => !element.isDeleted);
    const savedIds = new Set(toSave.map(element => element.id.toString()));
    const savedOrder = order.filter(id => savedIds.has(id));
    const toRows = (drawingId: number) =>
        toSave.map(element => ({
            data: element as Prisma.InputJsonValue,
            elementId: element.id.toString(),
            version: element.version,
            drawingId,
        }));

    try {
        const drawingId = await prisma.$transaction(async tx => {
            const existing = await tx.drawing.findUnique({ where: { slug } });

            if (existing) {
                await tx.drawingElement.deleteMany({
                    where: {
                        drawingId: existing.id,
                        elementId: { in: elements.map(element => element.id.toString()) },
                    },
                });
                await tx.drawingElement.createMany({ data: toRows(existing.id) });
                await tx.drawing.update({
                    where: { id: existing.id },
                    data: { order: savedOrder },
                });

                return existing.id;
            }

            const created = await tx.drawing.create({
                data: {
                    slug,
                    order: savedOrder,
                    owner: userId ? { connect: { id: userId } } : undefined,
                },
            });
            await tx.drawingElement.createMany({ data: toRows(created.id) });

            return created.id;
        });

        return Result.ok(drawingId);
    } catch (error) {
        logger.error({ error, slug }, `Error saving drawing: ${slug}`);
        return Result.error("Error saving drawing");
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
            return Result.error("Drawing not found");
        }

        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            logger.error(`User not found: ${userId}`);
            return Result.error("User not found");
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
            return Result.error("Error saving drawing to user");
        }

        return Result.ok();
    } catch (error) {
        logger.error({ error, slug, userId }, `Error saving drawing to user`);
        return Result.error("Error saving drawing to user");
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
            return Result.error("Error getting user collection");
        }

        const mapped = collection.collection.map(drawing => ({
            slug: drawing.slug,
            name: drawing.name ?? "untitled",
            isOwner: drawing.ownerId === userId,
        }));

        return Result.ok(mapped);
    } catch (error) {
        logger.error({ error, userId }, `Error getting user collection for user ${userId}`);
        return Result.error("Error getting user collection");
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
            return Result.error("Drawing not found");
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
            return Result.error("Error deleting drawing from user");
        }

        return Result.ok();
    } catch (error) {
        logger.error({ error, slug }, `Error deleting drawing from user: ${slug}`);
        return Result.error("Error deleting drawing from user");
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
            return Result.error("Drawing not found");
        }

        if (drawing.ownerId !== userId) {
            logger.error(`User not authorized to update drawing: ${slug}`);
            return Result.error("User not authorized to update drawing");
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
            return Result.error("Error updating drawing name");
        }

        return Result.ok();
    } catch (error) {
        logger.error({ error, slug }, `Error updating drawing name: ${slug}`);
        return Result.error("Error updating drawing name");
    }
};

export const DrawRepository = {
    getDrawingBySlug,
    saveDrawingFromDeltaUpdate,
    saveDrawingFromBoard,
    saveToCollection,
    getCollection,
    deleteDrawingFromCollection,
    updateDrawingName,
};
