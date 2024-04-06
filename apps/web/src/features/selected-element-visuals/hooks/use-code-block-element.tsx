import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";

export const useCodeBlockElement = () => {
    const { excalidrawApi } = useGlobal();

    const updateCodeBlockElements: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;
    };

    const render = () => {
        if (!excalidrawApi) return null;
        const elements = excalidrawApi.getSceneElements();
        const codeElements = elements.filter(CustomDataUtil.isCodeBlockElement);

        return (
            <>
                <div>hello</div>
            </>
        );
    };

    return {
        render,
        updateCodeBlockElements,
    };
};
