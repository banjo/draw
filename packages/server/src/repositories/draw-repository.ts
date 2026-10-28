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

/** Create a new drawing. Fails with a Conflict if the slug is taken, so it can't overwrite one. */
const createDrawing = async (
    slug: string,
    elements: ExcalidrawSimpleElement[],
    order: string[],
    userId?: number
) => {
    // Deleted elements only matter for collaboration, not when creating a drawing
    const toSave = elements.filter(element => !element.isDeleted);
    const savedIds = new Set(toSave.map(element => element.id.toString()));

    try {
        const created = await prisma.$transaction(async tx => {
            const existing = await tx.drawing.findUnique({ where: { slug } });
            if (existing) return undefined;

            return await tx.drawing.create({
                data: {
                    slug,
                    order: order.filter(id => savedIds.has(id)),
                    owner: userId ? { connect: { id: userId } } : undefined,
                    elements: {
                        create: toSave.map(element => ({
                            data: element as Prisma.InputJsonValue,
                            elementId: element.id.toString(),
                            version: element.version,
                        })),
                    },
                },
            });
        });

        if (!created) {
            logger.error({ slug }, "Drawing already exists");
            return Result.error("Drawing already exists", { type: "Conflict" });
        }

        return Result.ok(created.id);
    } catch (error) {
        logger.error({ error, slug }, `Error creating drawing: ${slug}`);
        return Result.error("Error creating drawing");
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
            return Result.error("User not authorized to update drawing", { type: "Unauthorized" });
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
    createDrawing,
    saveDrawingFromBoard,
    updateDrawingName,
};
