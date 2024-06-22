import { ElementExtensionShadow } from "@/features/draw/utils/element-visual-utils";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { isDefined, Maybe, produce, randomString } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElement, ExcalidrawElements, ExcalidrawLinearElement } from "common";

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

const getElementById = (elements: ExcalidrawElements, id: Maybe<string>) =>
    elements.find(element => element.id === id);

const getElementsByIds = (elements: ExcalidrawElements, ids: string[]) =>
    ids.map(id => elements.find(element => element.id === id)).filter(isDefined);

const removeDeletedElements = (elements: ExcalidrawElements) =>
    elements.filter(element => !element.isDeleted);

const removeElements = (elements: ExcalidrawElements, ids: string[]) =>
    elements.filter(element => !ids.includes(element.id));

const idDictionary = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
const createElementId = () => randomString(21, idDictionary);

/**
 * Reset element by mutation, creating a new id and setting version to 0.
 */
const resetElement = (element: ExcalidrawElement): ExcalidrawElement => ({
    ...element,
    isDeleted: false,
    id: createElementId(),
    version: 0,
    versionNonce: 0,
    groupIds: [],
    boundElements: [],
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
    const groups = renderedElements.flatMap(element => element.groupIds);

    const updatedState = produce(state, draft => {
        // @ts-ignore
        draft.selectedElementIds = ids.reduce(
            (acc, id) => {
                acc[id] = true;
                return acc;
            },
            {} as Record<string, boolean>
        );

        draft.selectedGroupIds = groups.reduce(
            (acc, id) => {
                acc[id] = true;
                return acc;
            },
            {} as Record<string, boolean>
        );
    });

    return { updatedState };
};

const createNewLinearElementSelection = (
    linearElement: ExcalidrawLinearElement,
    state: AppState
) => {
    const baseSelection = createNewElementSelection([linearElement], state);

    const updatedState = produce(baseSelection.updatedState, draft => {
        draft.selectedLinearElement = {
            elementId: linearElement.id as any,
            selectedPointsIndices: null,
            lastUncommittedPoint: null,
            isDragging: false,
            pointerOffset: {
                x: 0,
                y: 0,
            },
            startBindingElement: "keep",
            endBindingElement: "keep",
            pointerDownState: {
                prevSelectedPointsIndices: null,
                lastClickedPoint: -1,
                origin: null,
                segmentMidpoint: {
                    value: null,
                    index: null,
                    added: false,
                },
            },
            hoverPointIndex: -1,
            segmentMidPointHoveredCoords: null,
        };
    });

    return { updatedState };
};

/**
 * Merge new elements into the existing elements, replacing the existing elements with the same id. All new elements that are not in the existing elements are added.
 */
const mergeElements = (elements: ExcalidrawElements, newElements: ExcalidrawElements) => {
    const mergedElements = elements.map(element => {
        const newElement = newElements.find(newElement => newElement.id === element.id);
        return newElement || element;
    });

    const missedNewElements = newElements.filter(
        newElement => !elements.some(element => element.id === newElement.id)
    );

    return [...mergedElements, ...missedNewElements];
};

/**
 * Remove active elements, created to show temporary arrow extensions
 */
const removeShadowElementsById = (
    elements: ExcalidrawElements,
    shadowElements: ElementExtensionShadow
) => removeElements(elements, [shadowElements.arrowId, shadowElements.elementId]);

const removeShadowElementsByType = (elements: ExcalidrawElements) =>
    elements.filter(e => e.customData?.shadow !== true);

const getShadowElements = (elements: ExcalidrawElements) =>
    elements.filter(e => e.customData?.shadow === true);

const findCommonGroupId = (modelElements: ExcalidrawElement[]) => {
    const allGroupIds = modelElements.flatMap(element => element.groupIds);
    const groupIdCounts: Record<string, number> = {};
    allGroupIds.forEach(groupId => {
        if (!groupIdCounts[groupId]) {
            groupIdCounts[groupId] = 0;
        }
        groupIdCounts[groupId] += 1;
    });

    const groupIds = Object.keys(groupIdCounts);
    return groupIds.find(id => groupIdCounts[id] === modelElements.length);
};

const mutateInsertAfter = (
    elements: ExcalidrawElements,
    element: ExcalidrawElement,
    afterId: string
) => {
    const index = elements.findIndex(e => e.id === afterId);
    elements.splice(index + 1, 0, element);
};

const insertAfter = (elements: ExcalidrawElements, element: ExcalidrawElement, afterId: string) => {
    const newElements = [...elements];
    mutateInsertAfter(newElements, element, afterId);
    return newElements;
};

const mutateInsertBefore = (
    elements: ExcalidrawElements,
    element: ExcalidrawElement,
    beforeId: string
) => {
    const index = elements.findIndex(e => e.id === beforeId);
    elements.splice(index, 0, element);
};

const insertBefore = (
    elements: ExcalidrawElements,
    element: ExcalidrawElement,
    beforeId: string
) => {
    const newElements = [...elements];
    mutateInsertBefore(newElements, element, beforeId);
    return newElements;
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
    getShadowElements,
    getElementById,
    createNewLinearElementSelection,
    findCommonGroupId,
    mutateInsertAfter,
    insertAfter,
    mutateInsertBefore,
    insertBefore,
};
