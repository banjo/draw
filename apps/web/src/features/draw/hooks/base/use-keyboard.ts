import { ArrowKey, KeyboardUtil, MetaArrowResult } from "@/features/draw/utils/keyboard-util";
import { Maybe } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { KeyboardEventHandler, useState } from "react";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

export const useKeyboard = ({ excalidrawApi }: In) => {
    const [activeElements, setActiveElements] = useState<Maybe<MetaArrowResult>>(undefined);

    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        console.log(excalidrawApi.getSceneElements());
        console.log(excalidrawApi.getAppState());

        if (event.metaKey && event.key === "Enter") {
            // Smart copy
            KeyboardUtil.handleMetaEnter(event, excalidrawApi);
            return;
        }

        const arrowKeys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
        if (event.metaKey && arrowKeys.includes(event.key)) {
            // create new element to arrow direction
            const result = KeyboardUtil.handleMetaArrowDown(
                event,
                event.key as ArrowKey,
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
