import { useAuth } from "@/contexts/auth-context";
import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { removeDeletedElements } from "@/features/draw/utils/element-utils";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { Maybe, debounce, isEqual, wrapAsync } from "@banjoanton/utils";
import { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

type In = {
    slug: Maybe<string>;
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    setElements: (elements: ExcalidrawElements) => void;
    debouncedSetElements: (elements: ExcalidrawElements) => void;
    elements: ExcalidrawElements;
};

export type SaveDrawing = (
    elements: ExcalidrawElements,
    order: string[],
    createNewDrawing?: boolean
) => Promise<Maybe<string>>;

export const useDrawing = ({
    slug,
    excalidrawApi,
    setElements,
    elements,
    debouncedSetElements,
}: In) => {
    const navigate = useNavigate();
    const { userId } = useAuth();
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
                            order: order,
                            userId,
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
        [slug, userId]
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

    // update isFirstRun on slug change
    useEffect(() => {
        firstRun.current = true;
    }, [slug]);

    const firstRun = useRef(true);

    const onDrawingChange = async (e: ExcalidrawElements, state: AppState) => {
        const allButDeletedNewElements = removeDeletedElements(e);
        const allButDeletedOldElements = removeDeletedElements(elements);

        if (isEqual(allButDeletedNewElements, allButDeletedOldElements)) {
            return;
        }

        const updatedElements = allButDeletedNewElements.filter(newElement => {
            const oldElement = allButDeletedOldElements.find(el => el.id === newElement.id);
            if (!oldElement) return true;
            if (oldElement.version < newElement.version) return true;
            return false;
        });

        const elementsToDelete = allButDeletedOldElements
            .filter(oldElement => {
                const newElement = allButDeletedNewElements.find(el => el.id === oldElement.id);
                if (!newElement) return true;
                return false;
            })
            .map(element => ({ ...element, isDeleted: true }));

        const allElements = structuredClone(allButDeletedNewElements);
        const currentOrder = allElements.map(e => e.id);
        const elementsToSave = [...updatedElements, ...elementsToDelete];

        debouncedSetElements(allElements);
        debouncedSaveDrawing(elementsToSave, currentOrder);
    };

    return {
        saveDrawing,
        debouncedSaveDrawing,
        isSavingDrawing,
        isSavingDrawingRef,
        onDrawingChange,
    };
};
