import { ELEMENT_HEIGHT, ELEMENT_WIDTH } from "@/features/draw/models/constants";
import { ElementMeasurement } from "@/features/draw/models/element";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Maybe, clone } from "@banjoanton/utils";
import { isLinearElement } from "@excalidraw/excalidraw";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

export type KeyboardEvent = React.KeyboardEvent<HTMLDivElement>;

const handleMetaEnter = (event: KeyboardEvent, excalidrawApi: ExcalidrawImperativeAPI) => {
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

export type ArrowKey = "ArrowRight" | "ArrowLeft" | "ArrowUp" | "ArrowDown";
export type MetaArrowResult = { arrowId: string; elementId: string; selectedId: string };

const handleMetaArrowDown = (
    event: KeyboardEvent,
    direction: ArrowKey,
    excalidrawApi: ExcalidrawImperativeAPI,
    activeElements: Maybe<MetaArrowResult>
): Maybe<MetaArrowResult> => {
    const sceneElements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    let elements = sceneElements;
    if (activeElements) {
        elements = ElementUtil.removeElements(sceneElements, [
            activeElements.arrowId,
            activeElements.elementId,
        ]);
    }

    const selectedElements = ElementUtil.getSelectedElements(state, elements);
    if (selectedElements.length === 0) return;

    const sourceElement = ElementPositionUtil.getClosestElement(direction, selectedElements);
    if (!sourceElement) return;

    const arrowId = ElementUtil.createElementId();

    // move selected elements to original position as arrow keys adjust
    selectedElements.forEach(selected => {
        const newSourcePosition = ElementPositionUtil.reverseStep(
            direction,
            {
                x: selected.x,
                y: selected.y,
            },
            1
        );

        UpdateElementUtil.mutateElement(selected, (draft, helpers) => {
            draft.x = newSourcePosition.x;
            draft.y = newSourcePosition.y;
        });
    });

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

    const newElement = ElementCreationUtil.createRectangle(
        {
            height: measurements.height,
            width: measurements.width,
            x: x,
            y: y,
        },
        (draft, helpers) => {
            helpers.defaultSettings(draft);
            helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
            draft.opacity = 50;
            return draft;
        }
    );

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

const handleMetaArrowUp = (
    event: KeyboardEvent,
    metaArrowResult: MetaArrowResult,
    excalidrawApi: ExcalidrawImperativeAPI
) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const { arrowId, elementId, selectedId } = metaArrowResult;
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
        return element;
    });

    const updatedNewElement = UpdateElementUtil.updateElement(newElement, element => {
        element.opacity = 100;
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

export const KeyboardUtil = { handleMetaEnter, handleMetaArrowDown, handleMetaArrowUp };
