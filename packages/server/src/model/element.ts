import { z } from "zod";

export const elementSchema = z
    .object({
        id: z.string(),
        version: z.number(),
    })
    .passthrough();

export type ExcalidrawElement = z.infer<typeof elementSchema>;
