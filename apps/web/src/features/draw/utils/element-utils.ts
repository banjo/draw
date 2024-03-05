import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { isDefined } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";

const removeDeletedElements = (elements: ExcalidrawElements) => {
    return elements.filter(element => !element.isDeleted);
};

const getActiveElementIds = (state: AppState) => {
    const selectedIds = Object.keys(state.selectedElementIds);

    const editingElementsId: string[] = state.editingElement
        ? // @ts-expect-error - wrong with type, it contains a containerId in some cases
          [state.editingElement.id, state.editingElement?.containerId].filter(isDefined)
        : [];

    return [...selectedIds, ...editingElementsId];
};

const hasActiveElements = (state: AppState) => getActiveElementIds(state).length > 0;

export const ElementUtil = {
    removeDeletedElements,
    getActiveElementIds,
    hasActiveElements,
};
