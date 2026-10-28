import { FolderColor, MAX_FOLDERS, Result } from "common";
import { prisma } from "db";
import { createContextLogger } from "../lib/context-logger";
import { isWithin } from "../model/folder-tree";

const logger = createContextLogger("collection-repository");

type FolderChanges = {
    name?: string;
    color?: FolderColor;
    /** null moves it to the top level */
    parentId?: number | null;
};

type EntryChanges = {
    /** null moves it to unsorted */
    folderId?: number | null;
    pinned?: boolean;
};

const isOwnFolder = async (userId: number, folderId: number) =>
    (await prisma.folder.count({ where: { id: folderId, userId } })) > 0;

/** The user's drawings, with where they keep them, and their folders */
const getCollection = async (userId: number) => {
    try {
        const [entries, folders] = await prisma.$transaction([
            prisma.collectionEntry.findMany({
                where: { userId },
                select: {
                    folderId: true,
                    pinned: true,
                    drawing: {
                        select: {
                            slug: true,
                            name: true,
                            ownerId: true,
                            updatedAt: true,
                            owner: { select: { name: true, avatarUrl: true } },
                        },
                    },
                },
                orderBy: { drawing: { updatedAt: "desc" } },
            }),
            prisma.folder.findMany({
                where: { userId },
                select: { id: true, name: true, color: true, parentId: true },
                orderBy: { name: "asc" },
            }),
        ]);

        const drawings = entries.map(({ folderId, pinned, drawing }) => {
            const isOwner = drawing.ownerId === userId;
            return {
                slug: drawing.slug,
                name: drawing.name ?? "Untitled",
                updatedAt: drawing.updatedAt,
                isOwner,
                // Shown on drawings someone else shared
                owner: isOwner || !drawing.owner ? null : drawing.owner,
                folderId,
                pinned,
            };
        });

        return Result.ok({
            drawings,
            folders: folders.map(f => ({ ...f, color: f.color as FolderColor })),
        });
    } catch (error) {
        logger.error({ error, userId }, "Error getting collection");
        return Result.error("Error getting collection");
    }
};

const addToCollection = async (userId: number, slug: string) => {
    try {
        const drawing = await prisma.drawing.findUnique({ where: { slug }, select: { id: true } });
        if (!drawing) return Result.error("Drawing not found", { type: "NotFound" });

        await prisma.collectionEntry.upsert({
            where: { userId_drawingId: { userId, drawingId: drawing.id } },
            create: { userId, drawingId: drawing.id },
            update: {},
        });

        return Result.ok();
    } catch (error) {
        logger.error({ error, slug, userId }, "Error adding drawing to collection");
        return Result.error("Error adding drawing to collection");
    }
};

const removeFromCollection = async (userId: number, slug: string) => {
    try {
        const { count } = await prisma.collectionEntry.deleteMany({
            where: { userId, drawing: { slug } },
        });
        if (count === 0) return Result.error("Drawing not in collection", { type: "NotFound" });

        return Result.ok();
    } catch (error) {
        logger.error({ error, slug, userId }, "Error removing drawing from collection");
        return Result.error("Error removing drawing from collection");
    }
};

/** Move a drawing to another folder, or pin it */
const updateEntry = async (userId: number, slug: string, changes: EntryChanges) => {
    try {
        if (changes.folderId && !(await isOwnFolder(userId, changes.folderId))) {
            return Result.error("Folder not found", { type: "NotFound" });
        }

        const { count } = await prisma.collectionEntry.updateMany({
            where: { userId, drawing: { slug } },
            data: changes,
        });
        if (count === 0) return Result.error("Drawing not in collection", { type: "NotFound" });

        return Result.ok();
    } catch (error) {
        logger.error({ error, slug, userId }, "Error updating collection entry");
        return Result.error("Error updating collection entry");
    }
};

const createFolder = async (
    userId: number,
    folder: { name: string; color: FolderColor; parentId?: number | null }
) => {
    try {
        if ((await prisma.folder.count({ where: { userId } })) >= MAX_FOLDERS) {
            return Result.error(`A collection can have ${MAX_FOLDERS} folders`, {
                type: "BadRequest",
            });
        }

        if (folder.parentId && !(await isOwnFolder(userId, folder.parentId))) {
            return Result.error("Folder not found", { type: "NotFound" });
        }

        const created = await prisma.folder.create({
            data: { ...folder, userId },
            select: { id: true, name: true, color: true, parentId: true },
        });

        return Result.ok({ ...created, color: created.color as FolderColor });
    } catch (error) {
        logger.error({ error, userId }, "Error creating folder");
        return Result.error("Error creating folder");
    }
};

const updateFolder = async (userId: number, id: number, changes: FolderChanges) => {
    try {
        const folders = await prisma.folder.findMany({
            where: { userId },
            select: { id: true, parentId: true },
        });
        const parents = new Map(folders.map(f => [f.id, f.parentId]));

        if (!parents.has(id)) return Result.error("Folder not found", { type: "NotFound" });

        if (changes.parentId) {
            if (!parents.has(changes.parentId)) {
                return Result.error("Folder not found", { type: "NotFound" });
            }
            if (isWithin(changes.parentId, id, parents)) {
                return Result.error("A folder can't be moved into itself", {
                    type: "BadRequest",
                });
            }
        }

        await prisma.folder.update({ where: { id }, data: changes });
        return Result.ok();
    } catch (error) {
        logger.error({ error, id, userId }, "Error updating folder");
        return Result.error("Error updating folder");
    }
};

/** Delete a folder and its sub-folders. Their drawings go back to unsorted. */
const deleteFolder = async (userId: number, id: number) => {
    try {
        const { count } = await prisma.folder.deleteMany({ where: { id, userId } });
        if (count === 0) return Result.error("Folder not found", { type: "NotFound" });

        return Result.ok();
    } catch (error) {
        logger.error({ error, id, userId }, "Error deleting folder");
        return Result.error("Error deleting folder");
    }
};

export const CollectionRepository = {
    getCollection,
    addToCollection,
    removeFromCollection,
    updateEntry,
    createFolder,
    updateFolder,
    deleteFolder,
};
