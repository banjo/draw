import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { MIN_ELEMENT_HEIGHT, MIN_ELEMENT_WIDTH } from "@/features/draw/models/constants";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { first, includes, Maybe, produce } from "@banjoanton/utils";
import { PointBinding } from "@excalidraw/excalidraw/element/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import {
    CustomData,
    CustomElementType,
    ElementMeasurement,
    ExcalidrawApi,
    ExcalidrawElement,
    ExcalidrawLinearElement,
    ExcalidrawTextElement,
} from "common";
import { CustomDataUtil } from "./custom-data-util";

const COPY_OFFSET = 50;

const smartCopy = (excalidrawApi: ExcalidrawApi) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedElements = ElementUtil.getSelectedElements(state, elements);

    // handle "model" element, which should add a new text element to the container
    if (CustomDataUtil.isModelElements(selectedElements)) {
        const updatedElements = ElementCreationUtil.appendTextToModelElement(
            selectedElements,
            "example"
        );

        if (!updatedElements) return;

        const updatedState = produce(state, draft => {
            // @ts-ignore
            draft.selectedElementIds = {};

            updatedElements.forEach(element => {
                // @ts-ignore
                draft.selectedElementIds[element.id] = true;
            });
        });

        const allElements = ElementUtil.mergeElements(elements, updatedElements);

        excalidrawApi.updateScene({
            elements: allElements,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            appState: updatedState,
        });

        return;
    }

    // The copies get new ids. Bindings between copied elements, like an arrow between two
    // shapes or a shape's label, point to the copies; bindings to anything else are dropped.
    const idMap = new Map(
        selectedElements.map(element => [element.id, ElementUtil.createElementId()])
    );
    const groupIdMap = new Map<string, string>();
    const copyGroupId = (groupId: string) => {
        const existing = groupIdMap.get(groupId);
        if (existing) return existing;
        const created = ElementUtil.createElementId();
        groupIdMap.set(groupId, created);
        return created;
    };
    const copyBinding = (binding: Maybe<PointBinding> | null) => {
        const elementId = binding && idMap.get(binding.elementId);
        return binding && elementId ? { ...binding, elementId } : null;
    };

    const copies = selectedElements.map(element =>
        UpdateElementUtil.updateElement(element, draft => {
            draft.id = idMap.get(element.id) ?? ElementUtil.createElementId();
            draft.x += COPY_OFFSET;
            draft.y += COPY_OFFSET;
            draft.groupIds = element.groupIds.map(copyGroupId);
            draft.boundElements = (element.boundElements ?? []).flatMap(bound => {
                const id = idMap.get(bound.id);
                return id ? [{ ...bound, id }] : [];
            });

            if (ExcalidrawUtil.isTextElement(element)) {
                const text = draft as Mutable<ExcalidrawTextElement>;
                text.containerId = (element.containerId && idMap.get(element.containerId)) ?? null;
            }
            if (ExcalidrawUtil.isLinearElement(element)) {
                const linear = draft as Mutable<ExcalidrawLinearElement>;
                linear.startBinding = copyBinding(element.startBinding);
                linear.endBinding = copyBinding(element.endBinding);
            }
            return draft;
        })
    );

    // Labels aren't selected on their own
    const { updatedState } = ElementUtil.createNewElementSelection(
        copies.filter(element => !ElementUtil.isBoundText(element)),
        state
    );

    excalidrawApi.updateScene({
        elements: [...elements, ...copies],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        appState: updatedState,
    });
};

export type ElementExtensionShadow = {
    arrowId: string;
    elementId: string;
    selectedId: string;
    direction: ArrowKey;
};

const SHAPE_TYPES = ["rectangle", "ellipse", "diamond"] as const;
const isShapeType = (type: string): type is (typeof SHAPE_TYPES)[number] =>
    includes(SHAPE_TYPES, type);

/** What a shape added next to another copies from it */
const SHAPE_STYLE = [
    "strokeColor",
    "backgroundColor",
    "fillStyle",
    "strokeWidth",
    "strokeStyle",
    "roughness",
    "roundness",
    "opacity",
] as const;

/**
 * A new shape next to the source, of the same type and look, with a default arrow to it.
 * The preview (shadow) isn't bound to anything; the real one binds the arrow to both shapes.
 */
const createExtension = (direction: ArrowKey, source: ExcalidrawElement, shadow: boolean) => {
    const arrowId = ElementUtil.createElementId();
    const arrowOptions = ElementPositionUtil.getArrowOptionsFromSourceElement(direction, source);

    const measurements = ElementMeasurement.from({
        height: Math.max(source.height, MIN_ELEMENT_HEIGHT),
        width: Math.max(source.width, MIN_ELEMENT_WIDTH),
    });

    const { x, y } = ElementPositionUtil.getAddedElementOptions(
        direction,
        arrowOptions,
        measurements
    );

    const style = (draft: Mutable<ExcalidrawElement>) => {
        if (!shadow) return;
        draft.opacity = 50;
        draft.strokeStyle = "dashed";
    };

    // A copy of a shape's type and look; other elements, like images, get a plain rectangle
    const isShape = isShapeType(source.type);
    const type = isShape ? source.type : "rectangle";

    const element = ElementCreationUtil.createElement({
        base: {
            height: measurements.height,
            width: measurements.width,
            x,
            y,
            type,
        },
        callback: (draft, helpers) => {
            helpers.defaultSettings(draft);
            if (isShape) {
                SHAPE_STYLE.forEach(key => Object.assign(draft, { [key]: source[key] }));
            }
            draft.customData = CustomData.createDefault({ shadow, type });
            style(draft);
            if (!shadow) helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
            return draft;
        },
    });

    const arrow = ElementCreationUtil.createLinearElement(
        {
            x: arrowOptions.startX,
            y: arrowOptions.startY,
            points: [[0, 0], arrowOptions.relativeEndPoint],
            type: "arrow",
        },
        (draft, helpers) => {
            draft.id = arrowId;
            draft.customData = CustomData.createDefault({ shadow, type: "arrow" });
            style(draft);
            if (!shadow) {
                helpers.addArrowBindings(draft, { startId: source.id, endId: element.id });
            }
            return draft;
        }
    );

    const updatedSource = shadow
        ? source
        : UpdateElementUtil.updateElement(source, (draft, helpers) => {
              helpers.addBoundElements(draft, [{ id: arrowId, type: "arrow" }]);
              return draft;
          });

    return { arrow, element, source: updatedSource };
};

/** Shows where ⌘/Ctrl+arrow, or an extend button, would add a shape */
const createElementExtensionShadow = (
    direction: ArrowKey,
    excalidrawApi: ExcalidrawApi,
    shadowElements: Maybe<ElementExtensionShadow>
): Maybe<ElementExtensionShadow> => {
    const sceneElements = excalidrawApi.getSceneElements();
    const elements = shadowElements
        ? ElementUtil.removeShadowElementsById(sceneElements, shadowElements)
        : sceneElements;

    const selectedElements = ElementUtil.getSelectedElements(
        excalidrawApi.getAppState(),
        elements
    ).filter(element => !ElementUtil.isBoundText(element));

    const source = ElementPositionUtil.getClosestElement(direction, selectedElements);
    if (!source) return;

    const { arrow, element } = createExtension(direction, source, true);

    // Left out of undo: the preview is removed, and replaced when it's confirmed
    excalidrawApi.updateScene({
        elements: [...elements, arrow, element],
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });

    return { arrowId: arrow.id, elementId: element.id, selectedId: source.id, direction };
};

/** Removes the preview, e.g. when it's cancelled */
const removeElementExtensionShadow = (
    shadow: ElementExtensionShadow,
    excalidrawApi: ExcalidrawApi
) => {
    excalidrawApi.updateScene({
        elements: ElementUtil.removeShadowElementsById(excalidrawApi.getSceneElements(), shadow),
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
    });
};

/**
 * Replaces the preview with a real shape and arrow. They get new ids, as undo only tracks
 * elements it has seen being added, and the preview was left out of it.
 */
const createElementExtensionFromShadow = (
    shadow: ElementExtensionShadow,
    excalidrawApi: ExcalidrawApi
) => {
    const elements = ElementUtil.removeShadowElementsById(excalidrawApi.getSceneElements(), shadow);

    const source = ElementUtil.getElementById(elements, shadow.selectedId);
    if (!source) {
        excalidrawApi.updateScene({ elements, captureUpdate: CaptureUpdateAction.EVENTUALLY });
        return;
    }

    const {
        arrow,
        element,
        source: updatedSource,
    } = createExtension(shadow.direction, source, false);

    DrawingUtil.focusCanvas();

    const { updatedState } = ElementUtil.createNewElementSelection(
        [element],
        excalidrawApi.getAppState()
    );

    // remove binding circles
    updatedState.suggestedBindings = [];

    excalidrawApi.updateScene({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        appState: updatedState,
        elements: [...ElementUtil.mergeElements(elements, [updatedSource]), arrow, element],
    });
};

const updateElementFromTypeSelection = (excalidrawApi: ExcalidrawApi, type: CustomElementType) => {
    const state = excalidrawApi.getAppState();
    const elements = excalidrawApi.getSceneElements();

    const selected = ElementUtil.getSelectedElements(state, elements).filter(
        element => !ElementUtil.isBoundText(element)
    );
    if (selected.length !== 1) return;
    const element = first(selected);
    if (!element) return;

    // Between shapes, only the type changes, so arrows and the label stay attached
    if (isShapeType(element.type) && isShapeType(type)) {
        const updated = UpdateElementUtil.updateElement(element, draft => {
            (draft as { type: string }).type = type;
            draft.customData = CustomData.updateDefault(element.customData, { type });
            return draft;
        });

        excalidrawApi.updateScene({
            elements: ElementUtil.mergeElements(elements, [updated]),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return;
    }

    const newElements = ElementCreationUtil.createElementsFromElement({
        type,
        element,
    });

    // Marked as deleted, instead of left out, so the deletion reaches the server
    const updatedElements = ElementUtil.deleteElements(elements, [element.id]);
    const { updatedState } = ElementUtil.createNewElementSelection(newElements, state);

    excalidrawApi.updateScene({
        elements: [...updatedElements, ...newElements],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        appState: updatedState,
    });
};

export const ElementVisualUtils = {
    smartCopy,
    createElementExtensionShadow,
    createElementExtensionFromShadow,
    removeElementExtensionShadow,
    updateElementFromTypeSelection,
};
