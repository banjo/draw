import { useGlobal } from "@/contexts/global-context";
import { logger } from "@/utils/logger";
import { Maybe } from "@banjoanton/utils";
import { getSceneVersion } from "@excalidraw/excalidraw";
import { ExcalidrawElements } from "common";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

type In = {
    slug: Maybe<string>;
};

const localStorageKey = `drawing-base`;
const SAVE_DELAY = 500;

const readLocalElements = (): ExcalidrawElements => {
    try {
        const stored = localStorage.getItem(localStorageKey);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        logger.error({ error }, "Could not read the offline drawing");
        return [];
    }
};

/**
 * The elements the drawing starts with. The offline drawing (no slug) is read from
 * localStorage once, and saved from the scene shortly after it changes. The scene isn't
 * copied into React state, as that costs a full copy of the drawing on every change.
 */
export const useElementsState = ({ slug }: In) => {
    const { excalidrawApi } = useGlobal();
    const [initialElements] = useState<ExcalidrawElements>(() => (slug ? [] : readLocalElements()));

    const api = useRef(excalidrawApi);
    api.current = excalidrawApi;
    const timer = useRef<ReturnType<typeof setTimeout>>();
    // The scene version in localStorage, known once Excalidraw has loaded the drawing
    const savedVersion = useRef<number>();

    const getVersion = () =>
        // @ts-ignore - better local typings
        api.current ? getSceneVersion(api.current.getSceneElementsIncludingDeleted()) : undefined;

    // Saves when the scene changed since the last save. Comparing versions, instead of relying
    // on onChange, also catches a change made in the same render as leaving the drawing.
    const save = useCallback(() => {
        clearTimeout(timer.current);
        if (slug || !api.current || savedVersion.current === undefined) return;

        const version = getVersion();
        if (version === savedVersion.current) return;

        try {
            localStorage.setItem(localStorageKey, JSON.stringify(api.current.getSceneElements()));
            savedVersion.current = version;
        } catch (error) {
            logger.error({ error }, "Could not save the offline drawing");
        }
    }, [slug]);

    /** Call when the elements changed */
    const onElementsChange = useCallback(() => {
        if (slug) return;
        // The first call is Excalidraw loading the drawing, which is what's saved already
        if (savedVersion.current === undefined) {
            savedVersion.current = getVersion();
            return;
        }
        clearTimeout(timer.current);
        timer.current = setTimeout(save, SAVE_DELAY);
    }, [slug, save]);

    // Save what's left when leaving the drawing or closing the tab. A layout effect runs
    // before Excalidraw clears its scene on unmount.
    useLayoutEffect(() => {
        window.addEventListener("pagehide", save);
        return () => {
            window.removeEventListener("pagehide", save);
            save();
        };
    }, [save]);

    return {
        initialElements,
        onElementsChange,
    };
};
