import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { Maybe, wrapAsync } from "@banjoanton/utils";
import { ExcalidrawElements } from "common";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

export type CreateDrawing = (
    elements: ExcalidrawElements,
    order: string[]
) => Promise<Maybe<string>>;

/** Create a new drawing with a random slug. Existing drawings change through collaboration. */
export const useDrawing = () => {
    const { handleError } = useError();
    const utils = trpc.useUtils();

    const createDrawing: CreateDrawing = useCallback(async (elements, order) => {
        const slug = uuidv4();

        const [_, error] = await wrapAsync(
            async () =>
                await utils.client.draw.saveDrawing.mutate({
                    elements: elements as any,
                    slug,
                    order,
                })
        );

        if (error) {
            await handleError(error, { toast: true, errorMessage: "Could not save the drawing" });
            return;
        }

        return slug;
    }, []);

    return {
        createDrawing,
    };
};
