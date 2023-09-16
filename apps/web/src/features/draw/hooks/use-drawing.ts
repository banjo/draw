import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { removeDeletedElements } from "@/features/draw/utils/element-utils";
import { client } from "@/lib/hc";
import { Maybe, debounce, isEqual } from "@banjoanton/utils";
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

export type SaveDrawing = (elements: ExcalidrawElements, order: string[]) => Promise<Maybe<string>>;

export const useDrawing = ({
    slug,
    excalidrawApi,
    setElements,
    elements,
    debouncedSetElements,
}: In) => {
    const navigate = useNavigate();

    const [isSavingDrawing, setIsSavingDrawing] = useState(false);
    const isSavingDrawingRef = useRef(isSavingDrawing);

    // Sync the ref with the state value for setInterval to work properly
    useEffect(() => {
        isSavingDrawingRef.current = isSavingDrawing;
    }, [isSavingDrawing]);

    const saveDrawing: SaveDrawing = async (e: ExcalidrawElements, order: string[]) => {
        const currentSlug = slug ?? uuidv4();

        setIsSavingDrawing(true);
        const res = await client.draw.$post({
            json: {
                elements: e as any,
                slug: currentSlug,
                order: order,
            },
        });

        const data = await res.json();
        setIsSavingDrawing(false);

        if (!data.success) {
            return;
        }

        return currentSlug;
    };

    const debouncedSaveDrawing: (elements: ExcalidrawElements, order: string[]) => void = useMemo(
        () =>
            debounce(async (elements: ExcalidrawElements, order: string[]) => {
                if (!slug) return;
                await saveDrawing(elements, order);
            }, 300),
        []
    );

    const fetchDrawing = async (slug: string) => {
        const res = await client.draw[":slug"].$get({
            param: {
                slug,
            },
        });
        const json = await res.json();

        if (!json.success) {
            navigate("/");
            return;
        }

        if (!json.success) {
            navigate("/");
            return;
        }

        // @ts-ignore
        return json.data as unknown as ExcalidrawElement[];
    };

    // update isFirstRun on slug change
    useEffect(() => {
        firstRun.current = true;
    }, [slug]);

    const firstRun = useRef(true);

    // fetch drawing on load
    useEffect(() => {
        if (!slug || !excalidrawApi || firstRun.current === false) return;
        const getDrawing = async () => {
            const elements = await fetchDrawing(slug);

            if (!elements) return;

            const allButDeletedElements = removeDeletedElements(elements);
            setElements(allButDeletedElements);
            excalidrawApi.updateScene({
                elements: allButDeletedElements,
            });
        };

        getDrawing();
        firstRun.current = false;
    }, [excalidrawApi]);

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
        fetchDrawing,
        debouncedSaveDrawing,
        isSavingDrawing,
        isSavingDrawingRef,
        onDrawingChange,
    };
};
