import { z } from "zod";

/** What anyone with the link to a drawing can do. The owner can always edit. */
export const LinkAccessSchema = z.enum(["edit", "view", "private"]);
export type LinkAccess = z.infer<typeof LinkAccessSchema>;

/** What a person can do with a drawing */
export type DrawingRole = "owner" | "editor" | "viewer" | "none";

type AccessSettings = {
    ownerId: number | null;
    linkAccess: LinkAccess;
};

const LINK_ROLE: Record<LinkAccess, DrawingRole> = {
    edit: "editor",
    view: "viewer",
    private: "none",
};

/**
 * The role of a user (undefined when signed out) on a drawing. A drawing without an owner was
 * made signed out, so nobody can change who can open it, and anyone with the link can edit.
 */
const roleFor = ({ ownerId, linkAccess }: AccessSettings, userId?: number): DrawingRole => {
    if (ownerId === null) return "editor";
    if (userId !== undefined && ownerId === userId) return "owner";
    return LINK_ROLE[linkAccess];
};

const canView = (role: DrawingRole) => role !== "none";

const canEdit = (role: DrawingRole) => role === "owner" || role === "editor";

export const DrawingAccess = {
    roleFor,
    canView,
    canEdit,
};
