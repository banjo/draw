import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { initCodeblockMenuElement } from "@/features/selected-element-visuals/components/code-editor-menu";
import { useEffect } from "react";

export const useInit = () => {
    const { excalidrawApi } = useGlobal();

    const removeShadows = () => {
        if (!excalidrawApi) return;
        const elements = excalidrawApi.getSceneElements();
        const updated = ElementUtil.removeShadowElementsByType(elements);
        excalidrawApi.updateScene({ elements: updated });
    };

    const init = () => {
        removeShadows();
        initCodeblockMenuElement();
    };

    useEffect(() => {
        init();
    }, [excalidrawApi]);
};
