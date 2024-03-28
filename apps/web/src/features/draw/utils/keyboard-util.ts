import { ElementUtil } from "@/features/draw/utils/element-utils";
import { clone } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { ElementStateUtil } from "common";

export type KeyboardEvent = React.KeyboardEvent<HTMLDivElement>;

const handleMetaEnter = (event: KeyboardEvent, excalidrawApi: ExcalidrawImperativeAPI) => {
    const elements = excalidrawApi.getSceneElements();
    const state = excalidrawApi.getAppState();

    const selectedIds = ElementStateUtil.getSelectedElementIds(state);
    const selectedElements = elements.filter(element => selectedIds.includes(element.id));

    const copiedElements = selectedElements.map(element => {
        const cloned = clone(element);
        return ElementUtil.resetElement(cloned);
    });

    const { updatedElements, updatedState } = ElementUtil.createNewElementGroup(
        copiedElements,
        state
    );

    const movedElements = ElementUtil.updateElements(updatedElements, element => {
        element.x += 50;
        element.y += 50;
        return element;
    });

    excalidrawApi.updateScene({
        elements: [...elements, ...movedElements],
        commitToHistory: true,
        appState: updatedState,
    });
};

export const KeyboardUtil = { handleMetaEnter };
