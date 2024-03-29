import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
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

const removeDeletedElements = (elements: ExcalidrawElements) => {
    return elements.filter(element => !element.isDeleted);
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

    const updatedElements = UpdateElementUtil.updateElements(renderedElements, draft => {
        draft.groupIds = [newGroupId];
        return draft;
    });

    const updatedElementsIds = updatedElements.map(element => element.id);

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

    return { updatedElements, updatedState, newGroupId };
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
};
