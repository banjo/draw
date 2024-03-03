import { DrawingElement } from "db";
import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "./excalidraw-simple-element";

export const BoardSchema = z.object({ elements: z.array(ExcalidrawSimpleElementSchema) });
export type Board = z.infer<typeof BoardSchema>;

const fromDatabase = (elements: DrawingElement[]): Board => ({
    elements: elements.map(e => ExcalidrawSimpleElementSchema.parse(e.data)),
});

export const Board = {
    fromDatabase,
};
