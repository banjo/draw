import { useAuth } from "@/contexts/auth-context";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { debounce, Maybe, wrapAsync } from "@banjoanton/utils";
import { ExcalidrawElements } from "common";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

type In = {
    slug: Maybe<string>;
};

export type SaveDrawing = (
    elements: ExcalidrawElements,
    order: string[],
    createNewDrawing?: boolean
) => Promise<Maybe<string>>;

export const useDrawing = ({ slug }: In) => {
    const { handleError } = useError();

    const utils = trpc.useContext();

    const [isSavingDrawing, setIsSavingDrawing] = useState(false);
    const isSavingDrawingRef = useRef(isSavingDrawing);

    // Sync the ref with the state value for setInterval to work properly
    useEffect(() => {
        isSavingDrawingRef.current = isSavingDrawing;
    }, [isSavingDrawing]);

    const saveDrawing: SaveDrawing = useMemo(
        () =>
            async (e: ExcalidrawElements, order: string[], createNewDrawing = false) => {
                const shouldCreateNewDrawing = createNewDrawing || !slug;
                const currentSlug = shouldCreateNewDrawing ? uuidv4() : slug;

                setIsSavingDrawing(true);
                const [res, error] = await wrapAsync(
                    async () =>
                        await utils.client.draw.saveDrawing.mutate({
                            elements: e as any,
                            slug: currentSlug,
                            order,
                        })
                );

                if (error) {
                    await handleError(error);
                    setIsSavingDrawing(false);
                    return;
                }

                setIsSavingDrawing(false);

                return currentSlug;
            },
        [slug]
    );

    const debouncedSaveDrawing: (
        elements: ExcalidrawElements,
        order: string[],
        createNewDrawing?: boolean
    ) => void = useMemo(
        () =>
            debounce(
                async (elements: ExcalidrawElements, order: string[], createNewDrawing = false) => {
                    if (!slug) return;
                    await saveDrawing(elements, order, createNewDrawing);
                },
                300
            ),
        [saveDrawing, slug]
    );

    return {
        saveDrawing,
        debouncedSaveDrawing,
        isSavingDrawing,
        isSavingDrawingRef,
    };
};
