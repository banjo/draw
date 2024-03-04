import { Maybe, debounce } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useEffect, useMemo, useState } from "react";

type In = {
    slug: Maybe<string>;
};

const localStorageKey = `drawing-base`;

export type ExcalidrawElements = ExcalidrawElement[];

export const useElementsState = ({ slug }: In) => {
    const [localStorageElements, setLocalStorageElements] = useLocalStorage<ExcalidrawElements>(
        localStorageKey,
        []
    );

    const [elements, setElements] = useState<ExcalidrawElements>(() => {
        if (slug) return [];

        return localStorageElements ?? [];
    });

    const debouncedSetElements: (updatedElements: ExcalidrawElements) => void = useMemo(() => {
        return debounce((updatedElements: ExcalidrawElements) => {
            setElements(updatedElements);
        }, 300);
    }, []);

    useEffect(() => {
        if (slug) return;
        setLocalStorageElements(elements);
    }, [elements, slug]);

    return {
        elements,
        setElements,
        debouncedSetElements,
    };
};
