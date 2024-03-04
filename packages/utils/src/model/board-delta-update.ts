import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "./excalidraw-simple-element";

export const BoardDeltaUpdateSchema = z.object({
    excalidrawElements: ExcalidrawSimpleElementSchema.array(),
    order: z.string().array(),
    senderId: z.string().uuid(),
});

export type BoardDeltaUpdate = z.infer<typeof BoardDeltaUpdateSchema>;
