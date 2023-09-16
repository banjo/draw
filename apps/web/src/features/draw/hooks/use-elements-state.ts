import { Maybe, debounce } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "react-use";

type In = {
    slug: Maybe<string>;
};

const localStorageKey = `drawing-base`;

export type ExcalidrawElements = readonly ExcalidrawElement[];

export const useElementsState = ({ slug }: In) => {
    const [localStorageElements, setLocalStorageElements, remove] =
        useLocalStorage<ExcalidrawElements>(localStorageKey, []);

    const [elements, setElements] = useState<ExcalidrawElements>(() => {
        if (slug) return [];

        return localStorageElements ?? [];
    });

    const debouncedSetElements: (updatedElements: ExcalidrawElements) => void = useMemo(() => {
        return debounce((updatedElements: ExcalidrawElements) => {
            setElements([...updatedElements]);
        }, 300);
    }, []);

    useEffect(() => {
        console.log("elements changed", elements);
        if (slug) return;
        setLocalStorageElements(elements);
    }, [elements]);

    return {
        elements,
        setElements,
        debouncedSetElements,
    };
};
