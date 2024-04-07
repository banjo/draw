import { ElementUtil } from "@/features/draw/utils/element-util";
import { isEqual } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawApi, ExcalidrawElements } from "common";

type ApplyLocalDrawingChangesProps = {
    newElements: ExcalidrawElements;
    oldElements: ExcalidrawElements;
    newState: AppState;
    previousLockedElements: string[];
};

type ChangeResults = {
    allNewElements: ExcalidrawElements;
    allOldElements: ExcalidrawElements;
    currentLockedElements: string[];
};

type Changes = {
    elementsUpdated: boolean;
    lockStateHasChanged: boolean;
} & ChangeResults;

const getChangesWithLockedElements = ({
    newElements,
    oldElements,
    newState,
    previousLockedElements,
}: ApplyLocalDrawingChangesProps): Changes => {
    const allNewElements = ElementUtil.removeDeletedElements(newElements);
    const allOldElements = ElementUtil.removeDeletedElements(oldElements);
    const elementsUpdated = !isEqual(allNewElements, allOldElements);

    const currentLockedElements = ElementUtil.getLockedElementIds(newState);
    const lockStateHasChanged = !isEqual(previousLockedElements, currentLockedElements);

    return {
        elementsUpdated,
        lockStateHasChanged,
        allNewElements: structuredClone(allNewElements),
        allOldElements,
        currentLockedElements,
    };
};

type IsOnlyMouseChangeProps = {
    elements: ExcalidrawElements;
    appState: AppState;
    excalidrawApi: ExcalidrawApi;
};

// TODO: is this correct?
const isOnlyMouseChange = ({ elements, excalidrawApi, appState }: IsOnlyMouseChangeProps) => {
    const oldElements = excalidrawApi.getSceneElements();
    const oldAppState = excalidrawApi.getAppState();

    if (elements.length !== oldElements.length) return false;

    const allNewElements = ElementUtil.removeDeletedElements(elements);
    const allOldElements = ElementUtil.removeDeletedElements(oldElements);
    const elementsUpdated = !isEqual(allNewElements, allOldElements);

    if (elementsUpdated) return false;

    const stateUpdated = !isEqual(oldAppState, appState);
    return !stateUpdated;
};

type PrepareCollaborationChangesProps = ChangeResults & {
    previousLockedElements: string[];
};

const prepareCollaborationChanges = ({
    allNewElements,
    allOldElements,
    currentLockedElements,
    previousLockedElements,
}: PrepareCollaborationChangesProps) => {
    const affectedLockStateChangeElementIds = [...previousLockedElements, ...currentLockedElements];

    // update elements if lock state changed or if the elements are updated
    const updatedElements = allNewElements.filter(newElement => {
        if (affectedLockStateChangeElementIds.includes(newElement.id)) return true;
        const oldElement = allOldElements.find(el => el.id === newElement.id);
        if (!oldElement) return true;
        if (oldElement.version < newElement.version) return true;
        return false;
    });

    const elementsToDelete = allOldElements
        .filter(oldElement => {
            const newElement = allNewElements.find(el => el.id === oldElement.id);
            if (!newElement) return true;
            return false;
        })
        .map(element => ({ ...element, isDeleted: true }));

    // TODO: do not send an update one the first render, when it has fetched the board and applies it to the scene
    const currentOrder = allNewElements.map(e => e.id);
    const combinedElements = [...updatedElements, ...elementsToDelete];

    // lock active elements for other users, not for the local user
    const elementsToSave = combinedElements.map(element => {
        if (currentLockedElements.includes(element.id)) {
            return { ...element, locked: true };
        } else {
            return element;
        }
    });

    return { currentOrder, elementsToSave };
};

const focusCanvas = () => {
    const element = document.querySelector<HTMLDivElement>(".excalidraw");
    if (element) {
        element.focus();
    }
};

export const DrawingUtil = {
    getChangesWithLockedElements,
    prepareCollaborationChanges,
    isOnlyMouseChange,
    focusCanvas,
};
