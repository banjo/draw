import { logger } from "@/utils/logger";
import { Maybe } from "@banjoanton/utils";
import { ExcalidrawElements } from "common";
import { useCallback, useEffect, useRef, useState } from "react";

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
 * The elements of the drawing. The offline drawing (no slug) is read from localStorage once,
 * and saved shortly after it changes, instead of on every change.
 */
export const useElementsState = ({ slug }: In) => {
    const [elements, setElements] = useState<ExcalidrawElements>(() =>
        slug ? [] : readLocalElements()
    );

    const pending = useRef<ExcalidrawElements>();
    const timer = useRef<ReturnType<typeof setTimeout>>();

    const save = useCallback(() => {
        clearTimeout(timer.current);
        if (!pending.current) return;

        try {
            localStorage.setItem(localStorageKey, JSON.stringify(pending.current));
        } catch (error) {
            logger.error({ error }, "Could not save the offline drawing");
        }
        pending.current = undefined;
    }, []);

    useEffect(() => {
        if (slug) return;
        pending.current = elements;
        clearTimeout(timer.current);
        timer.current = setTimeout(save, SAVE_DELAY);
    }, [elements, slug]);

    // Save what's left when leaving the drawing or closing the tab
    useEffect(() => {
        window.addEventListener("pagehide", save);
        return () => {
            window.removeEventListener("pagehide", save);
            save();
        };
    }, [save]);

    return {
        elements,
        setElements,
    };
};
