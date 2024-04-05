import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { useEffect } from "react";

export const useInit = () => {
    const { excalidrawApi } = useGlobal();
    const init = () => {
        if (!excalidrawApi) return;
        const elements = excalidrawApi.getSceneElements();
        const updated = ElementUtil.removeShadowElementsByType(elements);
        excalidrawApi.updateScene({ elements: updated });
    };

    useEffect(() => {
        init();
    }, [excalidrawApi]);
};
