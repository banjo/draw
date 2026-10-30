import { placeElements, Placement } from "@/features/add-element/hooks/use-insert-element";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FrameUtil } from "@/features/draw/utils/frame-util";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import { DiagramSpec, ExcalidrawApi, ExcalidrawElement, ExcalidrawElements } from "common";
import { BuiltDiagram } from "./diagram-builder";
import { Selection } from "./diagram-reader";

export type AiResult =
    | { mode: "diagram"; summary: string; spec: DiagramSpec; built: BuiltDiagram }
    | {
          mode: "mermaid";
          summary: string;
          definition: string;
          built: { elements: ExcalidrawElements; files: BinaryFileData[] };
      };

const move = (elements: ExcalidrawElements, dx: number, dy: number) =>
    elements.map(element => ({ ...element, x: element.x + dx, y: element.y + dy }));

type Binding = { elementId: string } | null | undefined;
type Arrow = ExcalidrawElement & { startBinding?: Binding; endBinding?: Binding };

/** Out of a frame that's taken away */
const outOfRemovedFrame = (element: ExcalidrawElement, removed: Set<string>) =>
    element.frameId && removed.has(element.frameId) ? { ...element, frameId: null } : element;

/**
 * Arrows from outside connected to what took the place of what they were connected to, or
 * to nothing when it's gone
 */
const rebind = (
    element: ExcalidrawElement,
    removed: Set<string>,
    replacement: (id: string) => string | undefined
) => {
    const arrow = element as Arrow;
    const update = (binding: Binding) => {
        if (!binding || !removed.has(binding.elementId)) return binding;
        const id = replacement(binding.elementId);
        return id ? { ...binding, elementId: id } : null;
    };
    const startBinding = update(arrow.startBinding);
    const endBinding = update(arrow.endBinding);
    if (startBinding === arrow.startBinding && endBinding === arrow.endBinding) return element;
    return { ...element, startBinding, endBinding } as ExcalidrawElement;
};

/**
 * Adds the result and selects it, as one undo step. With a selection it takes the selection's
 * place; else it goes at the placement, in a frame there if it has none of its own.
 */
const insert = (
    api: ExcalidrawApi,
    result: AiResult,
    selection: Selection | undefined,
    placement: Placement
) => {
    const scene = api.getSceneElementsIncludingDeleted();
    let elements = result.built.elements;
    const isInPlace = result.mode === "diagram" && result.built.isInPlace;

    if (selection && !isInPlace) {
        const [minX, minY] = ExcalidrawUtil.getCommonBounds(elements);
        elements = move(elements, selection.origin.x - minX, selection.origin.y - minY);
    } else if (!selection) {
        elements = placeElements(elements, placement);
        if (!elements.some(element => element.type === "frame")) {
            elements = FrameUtil.addToFrame(elements, api.getSceneElements());
        }
    }

    if (selection?.frameId) {
        const { frameId } = selection;
        elements = elements.map(element => ({ ...element, frameId: element.frameId ?? frameId }));
    }

    const removed = new Set(selection?.replaces ?? []);
    const elementOf = result.mode === "diagram" ? result.built.elementOf : new Map();
    const replacement = (id: string) => {
        const node = selection?.nodeOf.get(id);
        return node ? elementOf.get(node) : undefined;
    };
    const kept = scene.map(element =>
        removed.has(element.id)
            ? { ...element, isDeleted: true }
            : rebind(outOfRemovedFrame(element, removed), removed, replacement)
    );

    // What arrows from outside are connected to now knows about them
    const boundFromOutside = new Map<string, string[]>();
    kept.forEach(element => {
        const arrow = element as Arrow;
        [arrow.startBinding, arrow.endBinding].forEach(binding => {
            if (!binding || removed.has(element.id)) return;
            if (!elements.some(added => added.id === binding.elementId)) return;
            boundFromOutside.set(binding.elementId, [
                ...(boundFromOutside.get(binding.elementId) ?? []),
                element.id,
            ]);
        });
    });
    elements = elements.map(element => {
        const arrows = boundFromOutside.get(element.id);
        if (!arrows) return element;
        const bound = arrows.map(id => ({ id, type: "arrow" as const }));
        return { ...element, boundElements: [...(element.boundElements ?? []), ...bound] };
    });

    const { updatedState } = ElementUtil.createNewElementSelection(
        elements.filter(element => !(ExcalidrawUtil.isTextElement(element) && element.containerId)),
        api.getAppState()
    );
    if (result.built.files.length > 0) api.addFiles(result.built.files);
    api.updateScene({
        elements: [...kept, ...elements] as ExcalidrawElements,
        appState: updatedState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
};

export const AiResultUtil = { insert };
