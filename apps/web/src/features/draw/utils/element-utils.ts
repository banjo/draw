import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

export const removeDeletedElements = (
    elements: ExcalidrawElements | readonly ExcalidrawElement[]
) => {
    return elements.filter(element => !element.isDeleted);
};
