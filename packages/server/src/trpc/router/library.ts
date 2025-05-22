import { TRPCError } from "@trpc/server";
import { LibrarySchema } from "common";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { LibraryRepository } from "../../repositories/library-repository";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const logger = createContextLogger("library-router");

export const libraryRouter = createTRPCRouter({
    getLibrary: protectedProcedure.query(async ({ ctx }) => {
        logger.trace("Getting library for user");
        const { userId } = ctx;

        if (!userId) {
            logger.error("Unauthorized");
            throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const library = await LibraryRepository.getLibraryByUser(userId);

        if (!library.success) {
            logger.error({ message: library.message }, "Failed to get drawing");
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: library.message });
        }

        return library.data;
    }),
    saveLibrary: publicProcedure
        .input(
            z.object({
                library: LibrarySchema,
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { library } = input;
            const { userId } = ctx;
            logger.trace(`Saving library`);

            if (!userId) {
                logger.error("Unauthorized");
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            const result = await LibraryRepository.saveLibraryByUser(userId, library);

            if (!result.success) {
                logger.error({ message: result.message }, "Failed to save library");
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: result.message,
                });
            }

            logger.info("Library saved");
            return result.data;
        }),
});
