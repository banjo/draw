import { useGlobal } from "@/contexts/global-context";
import { useExport } from "@/features/draw/hooks/base/use-export";
import { NativeContextMenu } from "@/features/draw/models/native/native-context-menu";
import { ElementUtil } from "@/features/draw/utils/element-util";

export const useContextMenu = () => {
    const { exportPngToClipboard, exportSvgToClipboard } = useExport();
    const { excalidrawApi } = useGlobal();

    const onContextMenu = async (e: React.MouseEvent) => {
        // allow native context menu to show
        setTimeout(() => {
            if (!excalidrawApi) return;
            const appState = excalidrawApi.getAppState();
            const elements = excalidrawApi.getSceneElements();

            const hasSelection = ElementUtil.getSelectedElements(appState, elements);

            const didFindMenu = NativeContextMenu.parse();
            if (!didFindMenu) return;

            NativeContextMenu.updateEntry({
                dataTestId: "copyAsPng",
                label: hasSelection
                    ? "Copy selection to clipboard as PNG"
                    : "Copy to clipboard as PNG",
                onClick: exportPngToClipboard,
            });

            NativeContextMenu.updateEntry({
                dataTestId: "copyAsSvg",
                label: hasSelection
                    ? "Copy selection to clipboard as SVG"
                    : "Copy to clipboard as SVG",
                onClick: exportSvgToClipboard,
            });
        }, 0);
    };

    return { onContextMenu };
};
