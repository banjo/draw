import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { produce, randomString } from "@banjoanton/utils";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { Mutable } from "@excalidraw/excalidraw/types/utility-types";

const removeDeletedElements = (elements: ExcalidrawElements) => {
    return elements.filter(element => !element.isDeleted);
};

const updateElements = (
    elements: ExcalidrawElements,
    callback: (element: Mutable<ExcalidrawElement>) => ExcalidrawElement
) => {
    return elements.map(element => {
        return produce(element, draft => {
            return callback(draft);
        });
    });
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

    const updatedElements = updateElements(renderedElements, draft => {
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
    updateElements,
    createNewElementSelection,
};
