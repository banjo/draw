import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";

const removeDeletedElements = (elements: ExcalidrawElements) => {
    return elements.filter(element => !element.isDeleted);
};

export const ElementUtil = {
    removeDeletedElements,
};
