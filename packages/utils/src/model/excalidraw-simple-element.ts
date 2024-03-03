import { z } from "zod";

export const ExcalidrawSimpleElementSchema = z
    .object({
        id: z.number().or(z.string()),
        version: z.number(),
        isDeleted: z.boolean(),
    })
    .passthrough();

export type ExcalidrawSimpleElement = z.infer<typeof ExcalidrawSimpleElementSchema>;

const from = (object: unknown): ExcalidrawSimpleElement =>
    ExcalidrawSimpleElementSchema.parse(object);

export const ExcalidrawSimpleElement = {
    from,
};
