import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { MIN_ELEMENT_HEIGHT, MIN_ELEMENT_WIDTH } from "@/features/draw/models/constants";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import {
    ElementCreationUtil,
    STICKY_NOTE_STYLE,
} from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FrameUtil } from "@/features/draw/utils/frame-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { isShapeType } from "@/models/shapes";
import { first, Maybe, produce } from "@banjoanton/utils";
import { PointBinding } from "@excalidraw/excalidraw/element/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import {
    CustomData,
    CustomElementType,
    ElementMeasurement,
    ExcalidrawApi,
    ExcalidrawElement,
    ExcalidrawElements,
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

/** The shape's type, as in the palettes, or undefined for blocks, images and the like */
const getShapeType = (element: ExcalidrawElement) => {
    const type = element.customData?.type ?? element.type;
    return isShapeType(type) ? type : undefined;
};

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
    const shapeType = getShapeType(source);
    const type = shapeType ?? "rectangle";

    const element = ElementCreationUtil.createElement({
        base: {
            height: measurements.height,
            width: measurements.width,
            x,
            y,
            type: ExcalidrawUtil.getElementTypeFromCustomType(type),
        },
        callback: (draft, helpers) => {
            helpers.defaultSettings(draft);
            if (shapeType) {
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

    const extension = createExtension(shadow.direction, source, false);
    const { source: updatedSource } = extension;
    // In the frame, like a swimlane, they're added inside of
    const [element = extension.element] = FrameUtil.addToFrame([extension.element], elements);
    const [arrow = extension.arrow] = FrameUtil.addToFrame([extension.arrow], elements);

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

type Point = [number, number];

/** Moves the elements so they're centered where the element is, as blocks have their own size */
const centerOn = (element: ExcalidrawElement, elements: ExcalidrawElement[]) => {
    const left = Math.min(...elements.map(({ x }) => x));
    const top = Math.min(...elements.map(({ y }) => y));
    const right = Math.max(...elements.map(({ x, width }) => x + width));
    const bottom = Math.max(...elements.map(({ y, height }) => y + height));
    const dx = element.x + element.width / 2 - (left + right) / 2;
    const dy = element.y + element.height / 2 - (top + bottom) / 2;

    return elements.map(created => ({ ...created, x: created.x + dx, y: created.y + dy }));
};

/** Where an arrow aimed at the element's center (focus 0) meets its edge, from `from` */
const getEdgePoint = (element: ExcalidrawElement, from: Point, gap: number): Point => {
    const halfWidth = element.width / 2 + gap;
    const halfHeight = element.height / 2 + gap;
    const center: Point = [element.x + element.width / 2, element.y + element.height / 2];
    const dx = from[0] - center[0];
    const dy = from[1] - center[1];
    if (dx === 0 && dy === 0) return center;

    const scale = Math.min(
        dx === 0 ? Infinity : halfWidth / Math.abs(dx),
        dy === 0 ? Infinity : halfHeight / Math.abs(dy)
    );
    return [center[0] + dx * scale, center[1] + dy * scale];
};

/** Moves the ends of arrows bound to `fromId` to `target`, and binds them to it */
const rebindArrows = (elements: ExcalidrawElements, fromId: string, target: ExcalidrawElement) => {
    const arrows: ExcalidrawLinearElement[] = [];

    const updated = elements.map(element => {
        if (!ExcalidrawUtil.isLinearElement(element) || element.isDeleted) return element;
        const start = element.startBinding?.elementId === fromId;
        const end = element.endBinding?.elementId === fromId;
        if (!start && !end) return element;

        const arrow = UpdateElementUtil.updateElement(element, draft => {
            const points = element.points.map(([x, y]): Point => [element.x + x, element.y + y]);
            // An arrow has at least two points
            const at = (index: number): Point => points[index] ?? [element.x, element.y];
            const last = points.length - 1;

            if (start && draft.startBinding) {
                draft.startBinding = { ...draft.startBinding, elementId: target.id };
                points[0] = getEdgePoint(target, at(1), draft.startBinding.gap);
            }
            if (end && draft.endBinding) {
                draft.endBinding = { ...draft.endBinding, elementId: target.id };
                points[last] = getEdgePoint(target, at(last - 1), draft.endBinding.gap);
            }

            const [originX, originY] = at(0);
            const xs = points.map(([x]) => x);
            const ys = points.map(([, y]) => y);
            draft.x = originX;
            draft.y = originY;
            draft.points = points.map(([x, y]) => [x - originX, y - originY]);
            draft.width = Math.max(...xs) - Math.min(...xs);
            draft.height = Math.max(...ys) - Math.min(...ys);
            return draft;
        });

        arrows.push(arrow);
        return arrow;
    });

    const boundTarget = UpdateElementUtil.updateElement(target, (draft, helpers) => {
        helpers.addBoundElements(
            draft,
            arrows.map(({ id }) => ({ id, type: "arrow" as const }))
        );
        return draft;
    });

    return { elements: updated, target: boundTarget };
};

/** Shapes look like their new type: a sticky note turns yellow, and a circle as wide as tall */
const changeShapeType = (
    element: ExcalidrawElement,
    from: CustomElementType,
    to: CustomElementType
) =>
    UpdateElementUtil.updateElement(element, draft => {
        (draft as { type: string }).type = ExcalidrawUtil.getElementTypeFromCustomType(to);
        draft.customData = CustomData.updateDefault(element.customData, { type: to });

        if (to === "sticky-note") {
            Object.assign(draft, STICKY_NOTE_STYLE);
        } else if (
            from === "sticky-note" &&
            element.backgroundColor === STICKY_NOTE_STYLE.backgroundColor
        ) {
            draft.backgroundColor = "transparent";
        }

        if (to === "circle" && element.width !== element.height) {
            const side = Math.max(element.width, element.height);
            draft.x -= (side - element.width) / 2;
            draft.y -= (side - element.height) / 2;
            draft.width = side;
            draft.height = side;
        }
        return draft;
    });

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
    const shapeType = getShapeType(element);
    if (shapeType && isShapeType(type)) {
        const updated = changeShapeType(element, shapeType, type);
        const isResized = updated.width !== element.width || updated.height !== element.height;
        // Arrows to the new edge, when it has moved
        const rebound = isResized ? rebindArrows(elements, element.id, updated) : undefined;

        excalidrawApi.updateScene({
            elements: ElementUtil.mergeElements(rebound?.elements ?? elements, [
                rebound?.target ?? updated,
            ]),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return;
    }

    const created = centerOn(
        element,
        ElementCreationUtil.createElementsFromElement({
            type,
            element,
        })
    );

    // Arrows stay connected, now to the code block or the model's box
    const target = created.find(({ customData }) => customData?.type === type) ?? first(created);
    const rebound = target ? rebindArrows(elements, element.id, target) : undefined;
    const newElements = created.map(created =>
        created.id === rebound?.target.id ? rebound.target : created
    );

    // Marked as deleted, instead of left out, so the deletion reaches the server
    const updatedElements = ElementUtil.deleteElements(rebound?.elements ?? elements, [element.id]);
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
