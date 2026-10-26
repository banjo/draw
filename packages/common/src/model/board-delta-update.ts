import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "./excalidraw-simple-element";

export const MAX_ELEMENTS = 20_000;

export const BoardDeltaUpdateSchema = z.object({
    excalidrawElements: ExcalidrawSimpleElementSchema.array().max(MAX_ELEMENTS),
    order: z.string().array().max(MAX_ELEMENTS).optional(),
});

export type BoardDeltaUpdate = z.infer<typeof BoardDeltaUpdateSchema>;

const empty = (): BoardDeltaUpdate => ({
    excalidrawElements: [],
    order: undefined,
});

const from = (boardDeltaUpdate: BoardDeltaUpdate): BoardDeltaUpdate => boardDeltaUpdate;

export const BoardDeltaUpdate = {
    empty,
    from,
};
