import { z } from "zod";

/** A cursor on a drawing, as sent to the other people on it. Set by the server. */
export const CollaboratorSchema = z.object({
    /** The WebSocket connection, one per browser tab */
    id: z.string(),
    x: z.number(),
    y: z.number(),
    name: z.string(),
    /** Signed-in users only. Excalidraw shows initials without one. */
    avatarUrl: z.string().optional(),
});

export type Collaborator = z.infer<typeof CollaboratorSchema>;

/** What a client sends about its own cursor. Signed-in users get their name from the session. */
export const CollaboratorUpdateSchema = z.object({
    x: z.number(),
    y: z.number(),
    name: z.string().trim().min(1).max(50),
});

export type CollaboratorUpdate = z.infer<typeof CollaboratorUpdateSchema>;
