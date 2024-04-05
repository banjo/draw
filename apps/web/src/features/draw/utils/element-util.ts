import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { ElementExtensionShadow } from "@/features/draw/utils/element-visual-utils";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { isDefined, produce, randomString } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";

const getSelectedElementIds = (state: AppState) => Object.keys(state.selectedElementIds);

const getSelectedElements = (state: AppState, elements: ExcalidrawElements) => {
    const ids = getSelectedElementIds(state);
    return elements.filter(element => ids.includes(element.id));
};

const getLockedElementIds = (state: AppState) => {
    // include if you want to lock the selected elements
    // const selectedIds = Object.keys(state.selectedElementIds);

    const editingElementsId: string[] = state.editingElement
        ? // @ts-expect-error - wrong with type, it contains a containerId in some cases
          [state.editingElement.id, state.editingElement?.containerId].filter(isDefined)
        : [];

    return editingElementsId;
};

const getElementsByIds = (elements: ExcalidrawElements, ids: string[]) => {
    return ids.map(id => elements.find(element => element.id === id)).filter(isDefined);
};

const removeDeletedElements = (elements: ExcalidrawElements) => {
    return elements.filter(element => !element.isDeleted);
};

const removeElements = (elements: ExcalidrawElements, ids: string[]) => {
    return elements.filter(element => !ids.includes(element.id));
};

const idDictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
const createElementId = () => randomString(21, idDictionary);

const resetElement = (element: ExcalidrawElement): ExcalidrawElement => ({
    ...element,
    isDeleted: false,
    id: createElementId(),
    version: 0,
    versionNonce: 0,
    groupIds: [],
});

const resetElements = (elements: ExcalidrawElements) => elements.map(resetElement);

const createNewElementGroup = (renderedElements: ExcalidrawElements, state: AppState) => {
    const newGroupId = createElementId();

    UpdateElementUtil.mutateElements(renderedElements, draft => {
        draft.groupIds = [newGroupId];
    });

    const updatedElementsIds = renderedElements.map(element => element.id);

    const updatedState = produce(state, draft => {
        // @ts-ignore
        draft.selectedElementIds = updatedElementsIds.reduce(
            (acc, id) => {
                acc[id] = true;
                return acc;
            },
            {} as Record<string, boolean>
        );

        draft.selectedGroupIds = {
            [newGroupId]: true,
        };
    });

    return { updatedState, newGroupId };
};

const createNewElementSelection = (renderedElements: ExcalidrawElements, state: AppState) => {
    const ids = renderedElements.map(element => element.id);

    const updatedState = produce(state, draft => {
        // @ts-ignore
        draft.selectedElementIds = ids.reduce(
            (acc, id) => {
                acc[id] = true;
                return acc;
            },
            {} as Record<string, boolean>
        );
    });

    return { updatedState };
};

/**
 * Merge new elements into the existing elements, replacing the existing elements with the same id.
 */
const mergeElements = (elements: ExcalidrawElements, newElements: ExcalidrawElements) => {
    return elements.map(element => {
        const newElement = newElements.find(newElement => newElement.id === element.id);
        return newElement || element;
    });
};

/**
 * Remove active elements, created to show temporary arrow extensions
 */
const removeShadowElementsById = (
    elements: ExcalidrawElements,
    shadowElements: ElementExtensionShadow
) => {
    return ElementUtil.removeElements(elements, [shadowElements.arrowId, shadowElements.elementId]);
};

const removeShadowElementsByType = (elements: ExcalidrawElements) => {
    return elements.filter(e => e.customData?.shadow !== true);
};

export const ElementUtil = {
    removeDeletedElements,
    resetElement,
    resetElements,
    createElementId,
    createNewElementGroup,
    createNewElementSelection,
    getSelectedElementIds,
    getSelectedElements,
    getLockedElementIds,
    getElementsByIds,
    mergeElements,
    removeElements,
    removeShadowElementsById,
    removeShadowElementsByType,
};
