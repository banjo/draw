import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";

export const removeDeletedElements = (elements: ExcalidrawElements) => {
    return elements.filter(element => !element.isDeleted);
};
