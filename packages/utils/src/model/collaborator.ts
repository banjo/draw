import { z } from "zod";

export const CollaboratorSchema = z.object({
    x: z.number(),
    y: z.number(),
    name: z.string(),
    avatarUrl: z.string(),
    id: z.string(),
});

export type Collaborator = z.infer<typeof CollaboratorSchema>;
