import { useGlobal } from "@/contexts/global-context";
import { CustomElementImageData } from "@/features/draw/models/custom-element-image-data";
import { FileUtil } from "@/features/draw/utils/file-util";
import { StateUtil } from "@/features/draw/utils/state-util";
import { CODE_ELEMENT_CLASS } from "@/features/selected-element-visuals/components/code-editor";
import { logger } from "@/utils/logger";
import { toIsoDateString } from "@banjoanton/utils";
import {
    exportToCanvas,
    exportToClipboard,
    exportToSvg as exportToSvgFunc,
} from "@excalidraw/excalidraw";
import { ExcalidrawApi } from "common";

const getCodeElements = (): HTMLElement[] => {
    return [...document.querySelectorAll(`.${CODE_ELEMENT_CLASS}`)] as HTMLElement[];
};

const prepare = async (excalidrawApi: ExcalidrawApi) => {
    const codeHtmlElements = getCodeElements();

    const codeExcalidrawElements = excalidrawApi
        .getSceneElements()
        .filter(e => e.customData?.type === "codeblock");

    if (codeExcalidrawElements.length !== codeHtmlElements.length) {
        logger.error("Code elements mismatch");
    }

    const customElements = await Promise.all(
        codeHtmlElements.map(async htmlElement =>
            CustomElementImageData.fromHtmlElement(htmlElement, codeExcalidrawElements)
        )
    );

    const newImageElements = customElements.map(CustomElementImageData.toExcalidrawImageElement);

    const currentElements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();

    StateUtil.mutateState(appState, draft => {
        draft.exportWithDarkMode = false;
        draft.exportBackground = true;
    });

    excalidrawApi.addFiles(customElements.map(e => e.binaryFileData));

    return {
        elements: [...currentElements, ...newImageElements],
        files: excalidrawApi.getFiles(),
        appState: appState,
        exportPadding: 5,
    };
};

export const useExport = () => {
    const { excalidrawApi } = useGlobal();

    const exportPngToClipboard = async () => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi);

        await exportToClipboard({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            type: "png",
            quality: 1,
        });
    };

    const exportSvgToClipboard = async () => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi);

        await exportToClipboard({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            type: "svg",
            quality: 1,
        });
    };

    const exportToPng = async () => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi);

        const canvas = await exportToCanvas({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            exportPadding,
        });

        const fileName = `banjodraw-${toIsoDateString(new Date())}.png`;
        FileUtil.downloadImage(canvas.toDataURL("image/png"), fileName);
    };

    const exportToSvg = async () => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi);

        const svg = await exportToSvgFunc({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            exportPadding,
            type: "svg",
        });

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);

        const fileName = `banjodraw-${toIsoDateString(new Date())}.svg`;
        FileUtil.downloadImage(url, fileName);
    };

    return { exportToPng, exportToSvg, exportPngToClipboard, exportSvgToClipboard };
};
