import { useGlobal } from "@/contexts/global-context";
import { OnChangeCallback } from "@/features/draw/draw";

export const useCodeBlockElement = () => {
    const { excalidrawApi } = useGlobal();

    const updateCodeBlockElements: OnChangeCallback = (elements, appState) => {
        if (!excalidrawApi) return;
    };

    const render = () => {
        if (!excalidrawApi) return null;
        const elements = excalidrawApi.getSceneElements();

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
