import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { KeyboardUtil, MetaArrowResult } from "@/features/draw/utils/keyboard-util";
import { useChangeElementStore } from "@/stores/use-change-element-store";
import { Callback, Maybe, includes } from "@banjoanton/utils";
import { KeyboardEventHandler, useState } from "react";

type In = {
    handleChangeElementDialogClick: Callback;
};

export const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

export const useKeyboard = ({ handleChangeElementDialogClick }: In) => {
    const { excalidrawApi } = useGlobal();
    const [activeElements, setActiveElements] = useState<Maybe<MetaArrowResult>>(undefined);
    const setShowChangeElementDialog = useChangeElementStore(
        state => state.setShowChangeElementDialog
    );
    const setMetaKeyIsDown = useChangeElementStore(state => state.setMetaKeyIsDown);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        console.log(excalidrawApi.getSceneElements());
        console.log(excalidrawApi.getAppState());

        const state = excalidrawApi.getAppState();

        if (event.key === "Meta") {
            setShowChangeElementDialog(false);
            setMetaKeyIsDown(true);
        }

        // If one element selected, allow change element type
        if (ElementUtil.getSelectedElementIds(state).length === 1 && event.key === "Tab") {
            handleChangeElementDialogClick();
        }

        if (event.metaKey && event.key === "Enter") {
            // Smart copy
            KeyboardUtil.handleMetaEnter(event, excalidrawApi);
            return;
        }

        if (event.metaKey && includes(ARROW_KEYS, event.key)) {
            // create new element to arrow direction
            const result = KeyboardUtil.handleMetaArrowDown(
                event,
                event.key,
                excalidrawApi,
                activeElements
            );

            setActiveElements(result);
            return;
        }
    };

    const handleKeyUp: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        if (event.key === "Meta") {
            setShowChangeElementDialog(true);
            setMetaKeyIsDown(false);
        }

        // finalize arrow creation
        if (activeElements && event.key === "Meta") {
            KeyboardUtil.handleMetaArrowUp(event, activeElements, excalidrawApi);
            setActiveElements(undefined);
            return;
        }
    };

    return {
        handleKeyDown,
        handleKeyUp,
    };
};
