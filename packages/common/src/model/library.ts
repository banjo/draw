import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "./excalidraw-simple-element";

export const LibraryItemSchema = z.object({
    status: z.string(),
    elements: ExcalidrawSimpleElementSchema.array(),
    id: z.string(),
    created: z.number(),
});

export type LibraryItem = z.infer<typeof LibraryItemSchema>;

export const LibrarySchema = LibraryItemSchema.array();
export type Library = z.infer<typeof LibrarySchema>;
