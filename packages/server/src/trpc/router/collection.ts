import { TRPCError } from "@trpc/server";
import {
    ExistingSlugSchema,
    FolderColorSchema,
    FolderIdSchema,
    FolderNameSchema,
    Result,
} from "common";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { createContextLogger } from "../../lib/context-logger";
import { CollectionRepository } from "../../repositories/collection-repository";
import { requireAccess } from "../require-access";

const logger = createContextLogger("collection-router");

type RepositoryResult<T> =
    { success: true; data: T } | { success: false; message: string; type: string };

const ERROR_CODES = {
    NotFound: "NOT_FOUND",
    BadRequest: "BAD_REQUEST",
} as const;

/** The data of a result, or the matching tRPC error */
const unwrap = <T>(result: RepositoryResult<T>, action: string): T => {
    if (result.success) return result.data;

    logger.error({ message: result.message }, `Failed to ${action}`);
    const code = ERROR_CODES[result.type as keyof typeof ERROR_CODES] ?? "INTERNAL_SERVER_ERROR";
    throw new TRPCError({ code, message: result.message });
};

const SlugInput = z.object({ slug: ExistingSlugSchema });

export const collectionRouter = createTRPCRouter({
    get: protectedProcedure.query(async ({ ctx }) =>
        unwrap(await CollectionRepository.getCollection(ctx.session.userId), "get collection")
    ),
    add: protectedProcedure.input(SlugInput).mutation(async ({ input, ctx }) => {
        await requireAccess(input.slug, ctx.session.userId, "view");
        unwrap(
            await CollectionRepository.addToCollection(ctx.session.userId, input.slug),
            "add drawing to collection"
        );
        return Result.ok();
    }),
    remove: protectedProcedure.input(SlugInput).mutation(async ({ input, ctx }) => {
        unwrap(
            await CollectionRepository.removeFromCollection(ctx.session.userId, input.slug),
            "remove drawing from collection"
        );
        return Result.ok();
    }),
    /** Move a drawing to a folder (null for unsorted), or pin it */
    updateEntry: protectedProcedure
        .input(
            SlugInput.extend({
                folderId: FolderIdSchema.nullable().optional(),
                pinned: z.boolean().optional(),
            })
        )
        .mutation(async ({ input: { slug, ...changes }, ctx }) => {
            unwrap(
                await CollectionRepository.updateEntry(ctx.session.userId, slug, changes),
                "update collection entry"
            );
            return Result.ok();
        }),
    createFolder: protectedProcedure
        .input(
            z.object({
                name: FolderNameSchema,
                color: FolderColorSchema,
                parentId: FolderIdSchema.nullable().optional(),
            })
        )
        .mutation(async ({ input, ctx }) =>
            unwrap(
                await CollectionRepository.createFolder(ctx.session.userId, input),
                "create folder"
            )
        ),
    /** Rename, recolor, or move a folder (parentId null for the top level) */
    updateFolder: protectedProcedure
        .input(
            z.object({
                id: FolderIdSchema,
                name: FolderNameSchema.optional(),
                color: FolderColorSchema.optional(),
                parentId: FolderIdSchema.nullable().optional(),
            })
        )
        .mutation(async ({ input: { id, ...changes }, ctx }) => {
            unwrap(
                await CollectionRepository.updateFolder(ctx.session.userId, id, changes),
                "update folder"
            );
            return Result.ok();
        }),
    deleteFolder: protectedProcedure
        .input(z.object({ id: FolderIdSchema }))
        .mutation(async ({ input, ctx }) => {
            unwrap(
                await CollectionRepository.deleteFolder(ctx.session.userId, input.id),
                "delete folder"
            );
            return Result.ok();
        }),
});
