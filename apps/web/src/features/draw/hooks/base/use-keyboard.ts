import { ElementUtil } from "@/features/draw/utils/element-util";
import { KeyboardUtil, MetaArrowResult } from "@/features/draw/utils/keyboard-util";
import { Callback, Maybe, includes } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { KeyboardEventHandler, useState } from "react";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    handleChangeElementDialogClick: Callback;
};

export const ARROW_KEYS = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"] as const;
export type ArrowKey = (typeof ARROW_KEYS)[number];

export const useKeyboard = ({ excalidrawApi, handleChangeElementDialogClick }: In) => {
    const [activeElements, setActiveElements] = useState<Maybe<MetaArrowResult>>(undefined);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        console.log(excalidrawApi.getSceneElements());
        console.log(excalidrawApi.getAppState());

        const state = excalidrawApi.getAppState();

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
