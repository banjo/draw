import { useGlobal } from "@/contexts/global-context";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { DragPosition, useDrag } from "@/features/draw/hooks/utils/use-drag";
import { DrawingUtil } from "@/features/draw/utils/drawing-util";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import {
    ElementExtensionShadow,
    ElementVisualUtils,
} from "@/features/draw/utils/element-visual-utils";
import { StateUtil } from "@/features/draw/utils/state-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { ExtendElementButton } from "@/features/selected-element-visuals/components/extend-element-button";
import { ExtendElementRefSummary } from "@/features/selected-element-visuals/hooks/use-extend-element-buttons";
import { logger } from "@/utils/logger";
import { first, isDefined, Maybe } from "@banjoanton/utils";
import { ExcalidrawBindableElement } from "@excalidraw/excalidraw/element/types";
import { AppState } from "@excalidraw/excalidraw/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { ExcalidrawElement, ExcalidrawLinearElement } from "common";
import {
    ArrowDownCircle,
    ArrowLeftCircle,
    ArrowRightCircle,
    ArrowUpCircle,
    LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";

type Props = {
    refs: ExtendElementRefSummary[];
};

const iconMap: Record<ArrowKey, LucideIcon> = {
    ArrowUp: ArrowUpCircle,
    ArrowRight: ArrowRightCircle,
    ArrowDown: ArrowDownCircle,
    ArrowLeft: ArrowLeftCircle,
};

export const ExtendElementsContainer = ({ refs }: Props) => {
    const { excalidrawApi } = useGlobal();
    const [shadowElements, setShadowElements] = useState<Maybe<ElementExtensionShadow>>(undefined);
    // The arrow being dragged out. A ref, as the drag handlers read it between renders.
    const arrowIdRef = useRef<string>();
    const [direction, setDirection] = useState<Maybe<ArrowKey>>(undefined);

    const onDragStart = (pos: DragPosition) => {
        if (!excalidrawApi) return;

        if (isDefined(arrowIdRef.current)) {
            logger.error("Arrow id should be undefined");
            return;
        }

        const state = excalidrawApi.getAppState();
        const elements = ElementUtil.removeShadowElementsByType(excalidrawApi.getSceneElements());

        const selected = first(ElementUtil.getSelectedElements(state, elements));
        if (!selected || !direction) return;

        const arrowPosition = ElementPositionUtil.getArrowOptionsFromSourceElement(
            direction,
            selected
        );

        // A preview, left out of undo, and replaced by a new arrow when it's dropped
        const arrow = ElementCreationUtil.createLinearElement(
            {
                points: [
                    [0, 0],
                    [0, 0],
                ],
                x: arrowPosition.startX,
                y: arrowPosition.startY,
                type: "arrow",
            },
            (element, helpers) => {
                helpers.addArrowBindings(element, {
                    startId: selected.id,
                });
                return element;
            }
        );

        // Drawn like a new arrow, so Excalidraw highlights the shape it would connect to. Only
        // the tool changes, not the style picked for what's drawn next.
        excalidrawApi.updateScene({
            appState: {
                newElement: arrow as AppState["newElement"],
                cursorButton: "down",
                activeTool: StateUtil.createActiveTool("arrow"),
            },
            elements: [...elements, arrow],
            captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });

        setShadowElements(undefined);
        arrowIdRef.current = arrow.id;
    };

    const onDrag = (pos: DragPosition) => {
        const arrowId = arrowIdRef.current;
        if (!excalidrawApi || !arrowId) return;

        const state = excalidrawApi.getAppState();
        const elements = excalidrawApi.getSceneElements();

        const arrow = ElementUtil.getElementById(elements, arrowId);
        if (!arrow) return;

        const { x, y } = ElementPositionUtil.getScenePositionFromWindowPosition(pos, state);

        const updatedArrow = UpdateElementUtil.updateElement(arrow, (element, helpers) => {
            const arrow = element as Mutable<ExcalidrawLinearElement>;
            arrow.points = [
                [0, 0],
                [x - arrow.x, y - arrow.y],
            ];
            arrow.width = Math.abs(x - arrow.x);
            arrow.height = Math.abs(y - arrow.y);
            return arrow;
        });

        const updatedElements = ElementUtil.mergeElements(elements, [updatedArrow]);
        excalidrawApi.updateScene({
            elements: updatedElements,
            // Excalidraw draws the element being drawn from here, and leaves it out of the scene
            // until it's done, so the arrow only showed once it was dropped
            appState: { newElement: updatedArrow as AppState["newElement"] },
            captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
    };

    const onDragEnd = (pos: DragPosition) => {
        const arrowId = arrowIdRef.current;
        arrowIdRef.current = undefined;
        if (!excalidrawApi || !arrowId) return;

        const state = excalidrawApi.getAppState();
        const sceneElements = excalidrawApi.getSceneElements();
        const preview = ElementUtil.getElementById(sceneElements, arrowId);
        const elements = ElementUtil.removeElements(sceneElements, [arrowId]);

        const selected = first(ElementUtil.getSelectedElements(state, elements));
        if (!selected || !preview) return;

        const suggestedEndBinding = first(
            state.suggestedBindings
        ) as Maybe<ExcalidrawBindableElement>;
        const suggestedEndElement = ElementUtil.getElementById(elements, suggestedEndBinding?.id);

        const { x, y } = ElementPositionUtil.getScenePositionFromWindowPosition(pos, state);

        const finalArrow = ElementCreationUtil.createLinearElement(
            {
                points: [
                    [0, 0],
                    [x - preview.x, y - preview.y],
                ],
                x: preview.x,
                y: preview.y,
                type: "arrow",
            },
            (element, helpers) => {
                helpers.addArrowBindings(element, {
                    endId: suggestedEndElement?.id,
                    startId: selected.id,
                });

                return element;
            }
        );

        const bindArrow = (element: ExcalidrawElement) =>
            UpdateElementUtil.updateElement(element, (draft, helpers) => {
                helpers.addBoundElements(draft, [{ id: finalArrow.id, type: "arrow" }]);
                return draft;
            });

        const boundElements = [selected, suggestedEndElement]
            .filter(isDefined)
            .filter((element, index, all) => all.findIndex(e => e.id === element.id) === index)
            .map(bindArrow);

        const stateAfterMouseDown = StateUtil.updateState(state, (draft, helpers) => {
            draft.newElement = null;
            draft.editingTextElement = null;
            draft.cursorButton = "up";
            helpers.setActiveTool(draft, "selection");
            helpers.clearBindings(draft);
            return draft;
        });

        const { updatedState } = ElementUtil.createNewLinearElementSelection(
            finalArrow,
            stateAfterMouseDown
        );

        // The arrow has a new id, as undo only tracks elements it has seen being added
        excalidrawApi.updateScene({
            appState: updatedState,
            elements: [...ElementUtil.mergeElements(elements, boundElements), finalArrow],
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        DrawingUtil.focusCanvas();
    };

    const getOnClick = (position: ArrowKey) => () => {
        if (!excalidrawApi) return;

        const newActiveElements = ElementVisualUtils.createElementExtensionShadow(
            position,
            excalidrawApi,
            shadowElements
        );

        if (!newActiveElements) return;
        ElementVisualUtils.createElementExtensionFromShadow(newActiveElements, excalidrawApi);
    };

    const drag = useDrag({ onDrag, onDragStart, onDragEnd, relativeToStart: false });

    const onMouseLeave = () => {
        if (!excalidrawApi || !shadowElements) return;
        ElementVisualUtils.removeElementExtensionShadow(shadowElements, excalidrawApi);
        setShadowElements(undefined);
    };

    const getOnMouseEnter = (position: ArrowKey) => () => {
        if (!excalidrawApi) return;
        setDirection(position);
        const newActiveElements = ElementVisualUtils.createElementExtensionShadow(
            position,
            excalidrawApi,
            shadowElements
        );
        if (newActiveElements) {
            setShadowElements(newActiveElements);
        }
    };

    return (
        <>
            {refs.map(({ position, ref }) => (
                <ExtendElementButton
                    key={position}
                    customRef={ref}
                    Icon={iconMap[position]}
                    onMouseLeave={onMouseLeave}
                    onMouseEnter={getOnMouseEnter(position)}
                    onClick={getOnClick(position)}
                    drag={drag}
                />
            ))}
        </>
    );
};
