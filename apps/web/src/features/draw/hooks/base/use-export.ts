import { useGlobal } from "@/contexts/global-context";
import { CustomElementImageData } from "@/features/draw/models/custom-element-image-data";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { StateUtil } from "@/features/draw/utils/state-util";
import { CODE_ELEMENT_CLASS } from "@/features/selected-element-visuals/components/code-editor";
import { logger } from "@/utils/logger";
import { isEmpty, toIsoDateString } from "@banjoanton/utils";
import {
    exportToCanvas,
    exportToClipboard,
    exportToSvg as exportToSvgFunc,
} from "@excalidraw/excalidraw";
import { ExcalidrawApi } from "common";

const getCodeElements = (): HTMLElement[] => {
    return [...document.querySelectorAll(`.${CODE_ELEMENT_CLASS}`)] as HTMLElement[];
};

const getFileName = (extension: string) => {
    return `banjodraw-${toIsoDateString(new Date())}.${extension}`;
};

const prepare = async (excalidrawApi: ExcalidrawApi, selectedOnly: boolean) => {
    const codeHtmlElements = getCodeElements();

    const codeExcalidrawElements = excalidrawApi
        .getSceneElements()
        .filter(e => e.customData?.type === "codeblock");

    if (codeExcalidrawElements.length !== codeHtmlElements.length) {
        logger.error("Code elements mismatch");
    }

    const customElements = await Promise.all(
        codeHtmlElements.map(async htmlElement => {
            const textArea = htmlElement.querySelector("textarea");
            if (textArea) {
                textArea.style.display = "none";
            }
            const imageData = CustomElementImageData.fromHtmlElement(
                htmlElement,
                codeExcalidrawElements
            );

            if (textArea) {
                textArea.style.display = "block";
            }

            return imageData;
        })
    );

    const newImageElements = customElements.map(CustomElementImageData.toExcalidrawImageElement);

    const currentElements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const selectedElements = ElementUtil.getSelectedElements(appState, currentElements);

    const elementsToExport =
        selectedOnly && !isEmpty(selectedElements) ? selectedElements : currentElements;

    StateUtil.mutateState(appState, draft => {
        draft.exportWithDarkMode = false;
        draft.exportBackground = true;
    });

    excalidrawApi.addFiles(customElements.map(e => e.binaryFileData));

    return {
        elements: [...elementsToExport, ...newImageElements],
        files: excalidrawApi.getFiles(),
        appState: appState,
        exportPadding: 5,
    };
};

export const useExport = () => {
    const { excalidrawApi } = useGlobal();

    const exportPngToClipboard = async () => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, true);

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

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, true);

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

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, false);

        const canvas = await exportToCanvas({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            exportPadding,
        });

        const fileName = getFileName("png");
        FileUtil.downloadImage(canvas.toDataURL("image/png"), fileName);
    };

    const exportToSvg = async () => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, false);

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

        const fileName = getFileName("svg");
        FileUtil.downloadImage(url, fileName);
    };

    return { exportToPng, exportToSvg, exportPngToClipboard, exportSvgToClipboard };
};
