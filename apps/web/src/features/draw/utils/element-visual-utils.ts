import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { ELEMENT_HEIGHT, ELEMENT_WIDTH } from "@/features/draw/models/constants";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Maybe, clone, first } from "@banjoanton/utils";
import {
    CustomData,
    CustomElementType,
    ElementMeasurement,
    ExcalidrawApi,
    ExcalidrawElement,
    ExcalidrawTextElement,
} from "common";

export type KeyboardEvent = React.KeyboardEvent<HTMLDivElement>;

const smartCopy = (excalidrawApi: ExcalidrawApi) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedElements = ElementUtil.getSelectedElements(state, elements);

    type HandledBoundElements = {
        oldId: string;
        newId: string;
        newElement: ExcalidrawElement;
    };
    const handledBoundElements: HandledBoundElements[] = [];
    const copiedElements = selectedElements.map(element => {
        const boundElementsIds = element.boundElements?.map(bound => bound.id) ?? [];
        const boundTextElements = ElementUtil.getElementsByIds(elements, boundElementsIds).filter(
            e => e.type === "text"
        );

        const cloned = clone(element);
        const updatedMainElement = ElementUtil.resetElement(cloned);

        const updatedBoundElements = boundTextElements.map(boundElement => {
            const cloned = clone(boundElement);
            const updatedBoundElement = ElementUtil.resetElement(cloned) as ExcalidrawTextElement;

            UpdateElementUtil.mutateElement(updatedBoundElement, (draft, helpers) => {
                draft.containerId = updatedMainElement.id;
            });

            handledBoundElements.push({
                oldId: boundElement.id,
                newId: updatedBoundElement.id,
                newElement: updatedBoundElement,
            });
            return updatedBoundElement;
        });

        UpdateElementUtil.mutateElement(updatedMainElement, (draft, helpers) => {
            helpers.addBoundElements(
                draft,
                updatedBoundElements.map(e => ({ id: e.id, type: e.type }))
            );
        });

        return updatedMainElement;
    });

    const allNewElements = [...copiedElements, ...handledBoundElements.map(e => e.newElement)];

    UpdateElementUtil.mutateElements(allNewElements, element => {
        element.x += 50;
        element.y += 50;
    });

    // do not include bound elements in the selection
    const { updatedState } = ElementUtil.createNewElementSelection(copiedElements, state);

    excalidrawApi.updateScene({
        elements: [...elements, ...allNewElements],
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

    if (shadowElements) {
        selectedElements.forEach(selected => {
            UpdateElementUtil.mutateElement(selected, (draft, helpers) => {
                helpers.removeBoundElements(draft, [shadowElements.arrowId]);
            });
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
        },
        (draft, helpers) => {
            draft.id = arrowId;
            draft.opacity = 50;
            draft.strokeStyle = "dashed";
            draft.customData = CustomData.createDefault({ shadow: true, type: "arrow" });
            helpers.addArrowBindings(draft, {
                startId: sourceElement.id,
                endId: newElement.id,
            });
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

// TODO: remove bound elements when arrow is no longer visible
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
    if (!ExcalidrawUtil.isLinearElement(arrow)) return;

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

const updateElementFromTypeSelection = (excalidrawApi: ExcalidrawApi, type: CustomElementType) => {
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
