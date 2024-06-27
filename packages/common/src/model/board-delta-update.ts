import { z } from "zod";
import { ExcalidrawSimpleElementSchema } from "./excalidraw-simple-element";

export const BoardDeltaUpdateSchema = z.object({
    excalidrawElements: ExcalidrawSimpleElementSchema.array(),
    order: z.string().array().optional(),
    clientId: z.string().uuid(),
});

export type BoardDeltaUpdate = z.infer<typeof BoardDeltaUpdateSchema>;

const empty = (): BoardDeltaUpdate => ({
    excalidrawElements: [],
    order: undefined,
    clientId: "",
});

const from = (boardDeltaUpdate: BoardDeltaUpdate): BoardDeltaUpdate => boardDeltaUpdate;

export const BoardDeltaUpdate = {
    empty,
    from,
};
