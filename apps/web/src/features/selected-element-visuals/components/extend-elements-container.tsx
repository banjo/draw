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
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { ExcalidrawLinearElement } from "common";
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
        let elements = excalidrawApi.getSceneElements();

        if (shadowElements) {
            elements = ElementUtil.removeShadowElementsByType(elements);
        }

        const selected = first(ElementUtil.getSelectedElements(state, elements));
        if (!selected || !direction) return;

        const arrowPosition = ElementPositionUtil.getArrowOptionsFromSourceElement(
            direction,
            selected
        );

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

        UpdateElementUtil.mutateElement(selected, (element, helpers) => {
            helpers.addBoundElements(element, [{ id: arrow.id, type: "arrow" }]);
        });

        StateUtil.mutateState(state, (draft, helpers) => {
            helpers.dragElement(draft, arrow);
            draft.cursorButton = "down";
            helpers.setActiveTool(draft, "arrow");
            helpers.arrowActiveToolDefaultSettings(draft);
        });

        excalidrawApi.updateScene({
            appState: state,
            elements: [...elements, arrow],
        });

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
            return arrow;
        });

        const updatedElements = ElementUtil.mergeElements(elements, [updatedArrow]);
        excalidrawApi.updateScene({
            elements: updatedElements,
        });
    };

    const onDragEnd = (pos: DragPosition) => {
        const arrowId = arrowIdRef.current;
        arrowIdRef.current = undefined;
        if (!excalidrawApi || !arrowId) return;

        const state = excalidrawApi.getAppState();
        const elements = excalidrawApi.getSceneElements();

        const selected = first(ElementUtil.getSelectedElements(state, elements));
        if (!selected) return;

        const arrow = ElementUtil.getElementById(elements, arrowId);
        if (!arrow) return;

        const suggestedEndBinding = first(
            state.suggestedBindings
        ) as Maybe<ExcalidrawBindableElement>;
        const suggestedEndElement = ElementUtil.getElementById(elements, suggestedEndBinding?.id);

        if (suggestedEndElement) {
            UpdateElementUtil.mutateElement(suggestedEndElement, (element, helpers) => {
                helpers.addBoundElements(element, [{ id: arrow.id, type: "arrow" }]);
            });
        }

        const { x, y } = ElementPositionUtil.getScenePositionFromWindowPosition(pos, state);

        const finalArrow = ElementCreationUtil.createLinearElement(
            {
                points: [
                    [0, 0],
                    [x - arrow.x, y - arrow.y],
                ],
                x: arrow.x,
                y: arrow.y,
                type: "arrow",
            },
            (element, helpers) => {
                element.id = arrow.id;

                helpers.addArrowBindings(element, {
                    endId: suggestedEndBinding?.id,
                    startId: selected.id,
                });

                return element;
            }
        );

        UpdateElementUtil.mutateElement(selected, (element, helpers) => {
            helpers.addBoundElements(element, [{ id: finalArrow.id, type: "arrow" }]);
        });

        const stateAfterMouseDown = StateUtil.updateState(state, (draft, helpers) => {
            draft.newElement = null;
            draft.editingTextElement = null;
            draft.cursorButton = "up";
            helpers.setActiveTool(draft, "selection");
            helpers.clearBindings(draft);
            return draft;
        });

        const mergedElements = ElementUtil.mergeElements(elements, [finalArrow]);

        const { updatedState } = ElementUtil.createNewLinearElementSelection(
            finalArrow,
            stateAfterMouseDown
        );

        excalidrawApi.updateScene({
            appState: updatedState,
            elements: mergedElements,
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
        if (!excalidrawApi) return;

        let elements = excalidrawApi.getSceneElements();
        const appState = excalidrawApi.getAppState();
        const selected = ElementUtil.getSelectedElements(appState, elements);

        if (selected.length === 1 && shadowElements) {
            UpdateElementUtil.mutateElements(selected, (element, helpers) => {
                helpers.removeBoundElements(element, [shadowElements.arrowId]);
            });
        }

        if (shadowElements) {
            elements = ElementUtil.removeShadowElementsById(elements, shadowElements);
        }

        excalidrawApi.updateScene({
            elements,
        });
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
