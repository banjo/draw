import { useExport } from "@/features/draw/hooks/base/use-export";
import { NativeContextMenu } from "@/features/draw/models/native/native-context-menu";

export const useContextMenu = () => {
    const { exportPngToClipboard, exportSvgToClipboard } = useExport();

    const onContextMenu = async (e: React.MouseEvent) => {
        // allow native context menu to show
        setTimeout(() => {
            NativeContextMenu.parse();
            NativeContextMenu.updateEntry({
                dataTestId: "copyAsPng",
                label: "Copy to clipboard as PNG",
                onClick: exportPngToClipboard,
            });

            NativeContextMenu.updateEntry({
                dataTestId: "copyAsSvg",
                label: "Copy to clipboard as SVG",
                onClick: exportSvgToClipboard,
            });
        }, 0);
    };

    return { onContextMenu };
};
