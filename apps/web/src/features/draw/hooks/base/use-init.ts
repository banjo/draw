import { useGlobal } from "@/contexts/global-context";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { initCodeblockMenuElement } from "@/features/selected-element-visuals/components/code-editor-menu";
import { useGlobalLoadingStore } from "@/stores/use-global-loading-store";
import { isEmpty, Maybe } from "@banjoanton/utils";
import { elementsOverlappingBBox } from "@excalidraw/excalidraw";
import { useEffect } from "react";
import { ElementPositionUtil } from "../../utils/element-position-util";
import { useInitClientId } from "./use-init-client-id";
import { useHelpMenu } from "./use-help-menu";

type Props = {
    slug: Maybe<string>;
};

export const useInit = ({ slug }: Props) => {
    useInitClientId();
    useHelpMenu();
    const { excalidrawApi } = useGlobal();
    const isLoading = useGlobalLoadingStore(state => state.isLoading);

    useEffect(() => {
        if (!excalidrawApi || isLoading) return;
        const elements = excalidrawApi.getSceneElements();
        const appState = excalidrawApi.getAppState();
        const bounds = ElementPositionUtil.getActiveViewportBounds(appState);

        // @ts-ignore - wrong elements type
        const elementsInViewport = elementsOverlappingBBox({ elements, bounds });

        if (isEmpty(elementsInViewport)) {
            excalidrawApi.scrollToContent();
        }
    }, [slug, excalidrawApi, isLoading]);

    useEffect(() => {
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

        init();
    }, [excalidrawApi]);
};
