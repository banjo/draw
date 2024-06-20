import { ElementUtil } from "@/features/draw/utils/element-util";
import { isEqual } from "@banjoanton/utils";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { ElementMeasurement, ExcalidrawApi, ExcalidrawElements } from "common";
import { CustomDataUtil } from "./custom-data-util";

type ApplyLocalDrawingChangesProps = {
    newElements: ExcalidrawElements;
    oldElements: ExcalidrawElements;
    newState: AppState;
};

type ChangeResults = {
    allNewElements: ExcalidrawElements;
    allOldElements: ExcalidrawElements;
};

type Changes = {
    elementsUpdated: boolean;
} & ChangeResults;

const getChanges = ({ newElements, oldElements }: ApplyLocalDrawingChangesProps): Changes => {
    const allNewElements = ElementUtil.removeDeletedElements(newElements);
    const allOldElements = ElementUtil.removeDeletedElements(oldElements);
    const elementsUpdated = !isEqual(allNewElements, allOldElements);

    return {
        elementsUpdated,
        allNewElements: structuredClone(allNewElements),
        allOldElements,
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

const prepareCollaborationChanges = ({ allNewElements, allOldElements }: ChangeResults) => {
    // update elements if the elements are updated
    const updatedElements = allNewElements.filter(newElement => {
        const oldElement = allOldElements.find(el => el.id === newElement.id);
        if (!oldElement) return true;
        if (oldElement.version < newElement.version) return true;
        return false;
    });

    const orderHasChanged = !isEqual(
        allNewElements.map(e => e.id),
        allOldElements.map(e => e.id)
    );

    const elementsToDelete = allOldElements
        .filter(oldElement => {
            const newElement = allNewElements.find(el => el.id === oldElement.id);
            if (!newElement) return true;
            return false;
        })
        .map(element => ({ ...element, isDeleted: true }));

    // TODO: do not send an update on the first render, when it has fetched the board and applies it to the scene
    const currentOrder = allNewElements.map(e => e.id);
    const elementsToSave = [...updatedElements, ...elementsToDelete].filter(
        e => !CustomDataUtil.isShadowElement(e) // do not save shadow elements
    );

    return { currentOrder: orderHasChanged ? currentOrder : undefined, elementsToSave };
};

const focusCanvas = () => {
    const element = document.querySelector<HTMLDivElement>(".excalidraw");
    if (element) {
        element.focus();
    }
};

const isElementTooSmall = (element: ElementMeasurement, zoomLevel: number, min: number) => {
    const adjustedWidth = element.width * zoomLevel;
    const adjustedHeight = element.height * zoomLevel;

    return adjustedWidth < min || adjustedHeight < min;
};

export const DrawingUtil = {
    getChanges,
    prepareCollaborationChanges,
    isOnlyMouseChange,
    focusCanvas,
    isElementTooSmall,
};
