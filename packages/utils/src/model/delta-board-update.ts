import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "./excalidraw-simple-element";

export const DeltaBoardUpdateSchema = z.object({
    excalidrawElements: ExcalidrawSimpleElementSchema.array(),
    order: z.string().array(),
});

export type DeltaBoardUpdate = z.infer<typeof DeltaBoardUpdateSchema>;
