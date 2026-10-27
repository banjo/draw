import { logger } from "@/utils/logger";
import { LibraryItems } from "@excalidraw/excalidraw/types/types";
import { useState } from "react";

const KEY = "banjo-library";

const readLibrary = (): LibraryItems => {
    try {
        const stored = localStorage.getItem(KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        logger.error({ error }, "Could not read the library");
        return [];
    }
};

/** The library is only Excalidraw's initial data, so it's read once and saved on changes. */
export const useLibrary = () => {
    const [library] = useState(readLibrary);

    const onLibraryChange = (data: LibraryItems) => {
        try {
            localStorage.setItem(KEY, JSON.stringify(data));
        } catch (error) {
            logger.error({ error }, "Could not save the library");
        }
    };

    return {
        onLibraryChange,
        library,
    };
};
