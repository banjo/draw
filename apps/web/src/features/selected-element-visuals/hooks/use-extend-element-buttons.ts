import { useGlobal } from "@/contexts/global-context";
import { ArrowKey } from "@/features/draw/hooks/base/use-keyboard";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { getExtendElementHandler } from "@/features/selected-element-visuals/models/extend-element-map";
import { ExcalidrawElement } from "common";
import { useRef, useState } from "react";

export type ExtendElementRefSummary = { ref: React.RefObject<HTMLDivElement>; position: ArrowKey };

export const useExtendElementsButtons = () => {
    const { excalidrawApi } = useGlobal();
    const [showExtendElements, setShowExtendElements] = useState(false);
    const extendTopRef = useRef<HTMLDivElement>(null);
    const extendRightRef = useRef<HTMLDivElement>(null);
    const extendBottomRef = useRef<HTMLDivElement>(null);
    const extendLeftRef = useRef<HTMLDivElement>(null);

    const refSummaries: ExtendElementRefSummary[] = [
        { ref: extendTopRef, position: "ArrowUp" },
        { ref: extendRightRef, position: "ArrowRight" },
        { ref: extendBottomRef, position: "ArrowDown" },
        { ref: extendLeftRef, position: "ArrowLeft" },
    ];

    const applyPosition = (selectedElement: ExcalidrawElement) => {
        if (!excalidrawApi) return;
        const isLinearElement = ExcalidrawUtil.isLinearElement(selectedElement);
        if (isLinearElement) return;

        const appState = excalidrawApi.getAppState();
        const { width, height } = ElementPositionUtil.getPositionFromElement(selectedElement);
        const { x, y } = ElementPositionUtil.getElementWindowPosition(selectedElement, appState);

        for (const summary of refSummaries) {
            const { ref, position } = summary;
            const calculate = getExtendElementHandler(position);
            const { refX, refY } = calculate({ appState, height, ref, width, x, y });
            ref.current?.setAttribute("style", `top: ${refY}px; left: ${refX}px`);
        }
    };

    return {
        refs: refSummaries,
        applyPosition,
        showExtendElements,
        setShowExtendElements,
    };
};
