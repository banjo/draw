import { TRPCError } from "@trpc/server";
import { Cause, ExistingSlugSchema, LinkAccessSchema, Result } from "common";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { DrawRepository } from "../../repositories/draw-repository";
import { AccessService } from "../../services/access-service";
import { requireAccess } from "../require-access";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const logger = createContextLogger("access-router");

export const accessRouter = createTRPCRouter({
    /** Your role on a drawing, and what anyone with the link can do */
    get: publicProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .query(async ({ input, ctx }) => {
            const { slug } = input;
            const role = await requireAccess(slug, ctx.userId, "view");
            const settings = await DrawRepository.getAccessSettings(slug);

            if (!settings.success || !settings.data) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
            }

            return {
                role,
                linkAccess: settings.data.linkAccess,
                hasOwner: settings.data.ownerId !== null,
            };
        }),
    setLinkAccess: protectedProcedure
        .input(z.object({ slug: ExistingSlugSchema, linkAccess: LinkAccessSchema }))
        .mutation(async ({ input, ctx }) => {
            const { slug, linkAccess } = input;
            const result = await AccessService.setLinkAccess(slug, ctx.session.userId, linkAccess);

            if (!result.success) {
                logger.error({ slug, message: result.message }, "Failed to change link access");
                if (result.type === "NotFound") {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: result.message,
                        cause: Cause.DRAWING_NOT_FOUND,
                    });
                }
                if (result.type === "Unauthorized") {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: result.message,
                        cause: Cause.NOT_OWNER,
                    });
                }
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
            }

            return Result.ok();
        }),
});
