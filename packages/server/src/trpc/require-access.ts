import { TRPCError } from "@trpc/server";
import { Cause, DrawingAccess, DrawingRole, Slug } from "common";
import { AccessService } from "../services/access-service";

export const drawingNotFound = () =>
    new TRPCError({
        code: "NOT_FOUND",
        message: "Drawing not found",
        cause: Cause.DRAWING_NOT_FOUND,
    });

export const noAccess = () =>
    new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to this drawing",
        cause: Cause.NO_ACCESS,
    });

/**
 * The user's role on the drawing, if it lets them view (or edit) it. Otherwise throws, as
 * not found when the drawing doesn't exist.
 */
export const requireAccess = async (
    slug: Slug,
    userId: number | undefined,
    needs: "view" | "edit"
): Promise<DrawingRole> => {
    const role = await AccessService.getRole(slug, userId);

    if (!role.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: role.message });
    }
    if (!role.data) throw drawingNotFound();

    const allowed =
        needs === "edit" ? DrawingAccess.canEdit(role.data) : DrawingAccess.canView(role.data);
    if (!allowed) throw noAccess();

    return role.data;
};
