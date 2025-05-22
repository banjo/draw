import { Library, Result } from "common";
import { Prisma, prisma } from "db";
import { createContextLogger } from "../lib/context-logger";

const logger = createContextLogger("library-repository");

const getLibraryByUser = async (userId: number) => {
    try {
        const response = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                libraryItems: true,
            },
        });

        if (!response) {
            logger.error(`Library not found for user`);
            return Result.ok();
        }

        logger.trace(`Library found for user`);
        return Result.ok(response.libraryItems);
    } catch (error) {
        logger.error({ error }, `Error getting library items for user`);
        return Result.error("Error getting library");
    }
};

const saveLibraryByUser = async (userId: number, library: Library) => {
    const libraryItems = library as Prisma.InputJsonValue[];
    try {
        const response = await prisma.user.update({
            where: { id: userId },
            data: { libraryItems },
        });
        logger.trace(`Library saved for user`);
        return Result.ok(response.libraryItems);
    } catch (error) {
        logger.error({ error }, `Error saving library items for user`);
        return Result.error("Error saving library");
    }
};

export const LibraryRepository = {
    getLibraryByUser,
    saveLibraryByUser,
};
