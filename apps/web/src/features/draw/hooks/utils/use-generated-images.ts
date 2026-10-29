import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import { ExcalidrawElement } from "common";
import { useRef } from "react";

type Rendered<Areas> = { file: BinaryFileData; areas: Areas };

/**
 * The images of blocks that every browser makes itself, like notes and tables: makes the
 * ones the drawing doesn't have yet, and keeps where things are in each, e.g. checkboxes
 */
export const useGeneratedImages = <Areas>(
    render: (element: ExcalidrawElement) => Promise<Rendered<Areas>>
) => {
    const { excalidrawApi } = useGlobal();
    const rendering = useRef(new Set<string>());
    const areas = useRef(new Map<string, Areas>());

    const renderMissing = (elements: ExcalidrawElement[]) => {
        if (!excalidrawApi) return;
        const files = excalidrawApi.getFiles();

        for (const element of elements) {
            if (!ExcalidrawUtil.isImageElement(element) || !element.fileId) continue;
            const fileId = element.fileId;
            if (rendering.current.has(fileId)) continue;
            if (files[fileId] && areas.current.has(fileId)) continue;

            rendering.current.add(fileId);
            render(element)
                .then(rendered => {
                    areas.current.set(fileId, rendered.areas);
                    // Under the element's id, which another browser may have made from older code
                    if (!excalidrawApi.getFiles()[fileId]) {
                        excalidrawApi.addFiles([{ ...rendered.file, id: fileId }]);
                    }
                })
                .catch(() => undefined)
                .finally(() => rendering.current.delete(fileId));
        }
    };

    const getAreas = (element: ExcalidrawElement) =>
        ExcalidrawUtil.isImageElement(element) && element.fileId
            ? areas.current.get(element.fileId)
            : undefined;

    return { renderMissing, getAreas };
};
