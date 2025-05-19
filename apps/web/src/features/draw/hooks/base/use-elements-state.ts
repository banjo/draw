import { useGlobal } from "@/contexts/global-context";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { debounce, first, Maybe } from "@banjoanton/utils";
import { useLocalStorage } from "@uidotdev/usehooks";
import { ExcalidrawElements } from "common";
import { useEffect, useMemo, useState } from "react";

type In = {
    slug: Maybe<string>;
};

const localStorageKey = `drawing-base`;

export const useElementsState = ({ slug }: In) => {
    const { excalidrawApi } = useGlobal();
    const isLoading = useGlobalLoadingStore(state => state.isLoading);
    const [localStorageElements, setLocalStorageElements] = useLocalStorage<ExcalidrawElements>(
        localStorageKey,
        []
    );

    const [elements, setElements] = useState<ExcalidrawElements>(() => {
        if (slug) return [];

        return localStorageElements ?? [];
    });

    const debouncedSetElements: (updatedElements: ExcalidrawElements) => void = useMemo(
        () =>
            debounce((updatedElements: ExcalidrawElements) => {
                setElements(updatedElements);
            }, 300),
        []
    );

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
