import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { ELEMENT_HEIGHT, ELEMENT_WIDTH } from "@/features/draw/models/constants";
import { ElementCreationUtil, ElementType } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Maybe, clone, first } from "@banjoanton/utils";
import { CustomData, ElementMeasurement, ExcalidrawApi, isLinearElement } from "common";

export type KeyboardEvent = React.KeyboardEvent<HTMLDivElement>;

const smartCopy = (excalidrawApi: ExcalidrawApi) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedIds = ElementUtil.getSelectedElementIds(state);
    const selectedElements = elements.filter(element => selectedIds.includes(element.id));

    const copiedElements = selectedElements.map(element => {
        const cloned = clone(element);
        return ElementUtil.resetElement(cloned);
    });

    // TODO: maybe not element group by default? Or maybe do?
    const { updatedState } = ElementUtil.createNewElementGroup(copiedElements, state);

    UpdateElementUtil.mutateElements(copiedElements, element => {
        element.x += 50;
        element.y += 50;
    });

    excalidrawApi.updateScene({
        elements: [...elements, ...copiedElements],
        commitToHistory: true,
        appState: updatedState,
    });
};

export type ElementExtensionShadow = { arrowId: string; elementId: string; selectedId: string };

const createElementExtensionShadow = (
    direction: ArrowKey,
    excalidrawApi: ExcalidrawApi,
    shadowElements: Maybe<ElementExtensionShadow>,
    revertStep = true
): Maybe<ElementExtensionShadow> => {
    const sceneElements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    let elements = sceneElements;
    if (shadowElements) {
        elements = ElementUtil.removeShadowElementsById(sceneElements, shadowElements);
    }

    const selectedElements = ElementUtil.getSelectedElements(state, elements);
    if (selectedElements.length === 0) return;

    // move selected elements to original position as arrow keys adjust
    if (revertStep) {
        selectedElements.forEach(selected => {
            UpdateElementUtil.mutateReverseStep(direction, selected);
        });
    }

    const sourceElement = ElementPositionUtil.getClosestElement(direction, selectedElements);
    if (!sourceElement) return;

    const arrowId = ElementUtil.createElementId();

    UpdateElementUtil.mutateElement(sourceElement, (draft, helpers) => {
        helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
    });

    const arrowOptions = ElementPositionUtil.getArrowOptionsFromSourceElement(
        direction,
        sourceElement
    );

    const measurements = ElementMeasurement.from({
        height: Math.max(sourceElement.height, ELEMENT_HEIGHT),
        width: Math.max(sourceElement.width, ELEMENT_WIDTH),
    });

    const { x, y } = ElementPositionUtil.getAddedElementOptions(
        direction,
        arrowOptions,
        measurements
    );

    const newElement = ElementCreationUtil.createElement({
        base: {
            height: measurements.height,
            width: measurements.width,
            x: x,
            y: y,
            type: "rectangle",
        },
        props: {
            strokeStyle: "dashed",
            customData: {
                shadow: true,
            },
        },
        callback: (draft, helpers) => {
            helpers.defaultSettings(draft);
            helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
            draft.opacity = 50;
            return draft;
        },
    });

    const arrow = ElementCreationUtil.createArrow(
        {
            x: arrowOptions.startX,
            y: arrowOptions.startY,
            points: [[0, 0], arrowOptions.relativeEndPoint],
            startBindingId: sourceElement.id,
            endBindingId: newElement.id,
        },
        draft => {
            draft.id = arrowId;
            draft.opacity = 50;
            draft.strokeStyle = "dashed";
            draft.customData = CustomData.createDefault({ shadow: true });
            return draft;
        }
    );

    excalidrawApi.updateScene({
        elements: [...elements, arrow, newElement],
    });

    return {
        arrowId,
        elementId: newElement.id,
        selectedId: sourceElement.id,
    };
};

const createElementExtensionFromShadow = (
    shadow: ElementExtensionShadow,
    excalidrawApi: ExcalidrawApi
) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const { arrowId, elementId, selectedId } = shadow;
    const elementsToModify = ElementUtil.getElementsByIds(elements, [
        arrowId,
        elementId,
        selectedId,
    ]);

    if (elementsToModify.length === 0) return;

    const [arrow, newElement, selected] = elementsToModify;
    if (!arrow || !newElement || !selected) return;
    if (!isLinearElement(arrow)) return;

    const updatedArrow = UpdateElementUtil.updateElement(arrow, (element, helpers) => {
        helpers.addArrowBindings(element, { endId: newElement.id, startId: selected.id });
        element.opacity = 100;
        element.strokeStyle = "solid";

        if (element.customData) {
            element.customData = CustomData.updateDefault(element.customData, {
                shadow: false,
            });
        }

        return element;
    });

    const updatedNewElement = UpdateElementUtil.updateElement(newElement, element => {
        element.opacity = 100;
        element.strokeStyle = "solid";

        if (element.customData) {
            element.customData = CustomData.updateDefault(element.customData, {
                shadow: false,
            });
        }

        return element;
    });

    const { updatedState } = ElementUtil.createNewElementSelection([updatedNewElement], state);
    const allElements = ElementUtil.mergeElements(elements, [updatedArrow, updatedNewElement]);

    // remove binding circles
    updatedState.suggestedBindings = [];

    excalidrawApi.updateScene({
        commitToHistory: true,
        appState: updatedState,
        elements: allElements,
    });
};

const updateElementFromTypeSelection = (excalidrawApi: ExcalidrawApi, type: ElementType) => {
    const state = excalidrawApi.getAppState();
    const elements = excalidrawApi.getSceneElements();

    const selected = ElementUtil.getSelectedElements(state, elements);
    if (selected.length !== 1) return;
    const element = first(selected);
    if (!element) return;

    const newElement = ElementCreationUtil.createElementFromElement({
        type,
        element,
    });

    const updatedElements = ElementUtil.removeElements(elements, [element.id]);
    const { updatedState } = ElementUtil.createNewElementSelection([newElement], state);

    excalidrawApi.updateScene({
        elements: [...updatedElements, newElement],
        commitToHistory: true,
        appState: updatedState,
    });
};

export const ElementVisualUtils = {
    smartCopy,
    createElementExtensionShadow,
    createElementExtensionFromShadow,
    updateElementFromTypeSelection,
};
