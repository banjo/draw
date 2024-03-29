import { ArrowKey, KeyboardUtil } from "@/features/draw/utils/keyboard-util";
import { Maybe } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { KeyboardEventHandler } from "react";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
};

export const useKeyboard = ({ excalidrawApi }: In) => {
    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = event => {
        if (!excalidrawApi) return;

        console.log(excalidrawApi.getSceneElements());
        console.log(excalidrawApi.getAppState());

        if (event.metaKey && event.key === "Enter") {
            // Copy selected elements
            KeyboardUtil.handleMetaEnter(event, excalidrawApi);
            return;
        }

        const arrowKeys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
        if (event.metaKey && arrowKeys.includes(event.key)) {
            // create new element to right with arrow
            KeyboardUtil.handleMetaArrow(event, event.key as ArrowKey, excalidrawApi);
            return;
        }
    };

    return {
        handleKeyDown,
    };
};
