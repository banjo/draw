import { useGlobal } from "@/contexts/global-context";
import { CustomElementImageData } from "@/features/draw/models/custom-element-image-data";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { StateUtil } from "@/features/draw/utils/state-util";
import { CODE_ELEMENT_CLASS } from "@/features/selected-element-visuals/components/code-editor";
import { logger } from "@/utils/logger";
import { isEmpty, toIsoDateString } from "@banjoanton/utils";
import {
    exportToCanvas as exportToCanvasLocal,
    exportToClipboard as exportToClipboardLocal,
    exportToSvg as exportToSvgFunc,
} from "@excalidraw/excalidraw";
import { ExcalidrawApi } from "common";

export type ExportOpts = {
    format: "png" | "svg";
    useDarkMode: boolean;
    exportBackground: boolean;
};

const getCodeElements = (): HTMLElement[] =>
    [...document.querySelectorAll(`.${CODE_ELEMENT_CLASS}`)] as HTMLElement[];

const getFileName = (extension: string) => `banjodraw-${toIsoDateString(new Date())}.${extension}`;

const prepare = async (excalidrawApi: ExcalidrawApi, opts: ExportOpts) => {
    const currentElements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const selectedElements = ElementUtil.getSelectedElements(appState, currentElements);

    const elementsToExport = isEmpty(selectedElements) ? currentElements : selectedElements;
    const elementsToExportIds = new Set(elementsToExport.map(e => e.id));

    const codeExcalidrawElements = elementsToExport.filter(e => e.customData?.type === "codeblock");
    const codeHtmlElements = getCodeElements().filter(e => {
        const elementId = e.dataset?.elementId ?? "";
        return elementsToExportIds.has(elementId);
    });

    if (codeExcalidrawElements.length !== codeHtmlElements.length) {
        logger.error("Code elements mismatch");
    }

    const customElements = await Promise.all(
        codeHtmlElements.map(async htmlElement => {
            // remove rounded border for code as it wont get rendered correctly
            const currentRadius = htmlElement.style.borderRadius;
            htmlElement.style.borderRadius = "0";

            const textArea = htmlElement.querySelector("textarea");
            if (textArea) {
                textArea.style.display = "none";
            }
            const imageData = CustomElementImageData.fromHtmlElement(
                htmlElement,
                codeExcalidrawElements
            );

            // reset the element
            htmlElement.style.borderRadius = currentRadius;

            if (textArea) {
                textArea.style.display = "block";
            }

            return imageData;
        })
    );

    const newImageElements = customElements.map(CustomElementImageData.toExcalidrawImageElement);

    StateUtil.mutateState(appState, draft => {
        draft.exportWithDarkMode = opts.useDarkMode;
        draft.exportBackground = opts.exportBackground;
    });

    excalidrawApi.addFiles(customElements.map(e => e.binaryFileData));

    return {
        elements: [...elementsToExport, ...newImageElements],
        files: excalidrawApi.getFiles(),
        appState,
        exportPadding: 5,
    };
};

export const useExport = () => {
    const { excalidrawApi } = useGlobal();

    const exportToClipboard = async (opts: ExportOpts) => {
        if (!excalidrawApi) return;

        const { appState, elements, files } = await prepare(excalidrawApi, opts);

        await exportToClipboardLocal({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            quality: 1,
            type: opts.format,
        });
    };

    const exportToCanvas = async (opts: ExportOpts) => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, opts);

        const canvas = await exportToCanvasLocal({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            exportPadding,
        });

        return canvas;
    };

    const getPng = async (opts: ExportOpts) => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, opts);

        const canvas = await exportToCanvasLocal({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            exportPadding,
        });

        return canvas.toDataURL("image/png");
    };

    const exportToPng = async (opts: ExportOpts) => {
        if (!excalidrawApi) return;
        const png = await getPng(opts);
        if (!png) return;

        const fileName = getFileName("png");
        FileUtil.downloadImage(png, fileName);
    };

    const getSvg = async (opts: ExportOpts) => {
        if (!excalidrawApi) return;

        const { appState, elements, exportPadding, files } = await prepare(excalidrawApi, opts);

        const svg = await exportToSvgFunc({
            // @ts-ignore - wrong with local types
            elements,
            files,
            appState,
            exportPadding,
        });

        return svg;
    };

    const exportToSvg = async (opts: ExportOpts) => {
        if (!excalidrawApi) return;

        const svg = await getSvg(opts);
        if (!svg) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);

        const fileName = getFileName("svg");
        FileUtil.downloadImage(url, fileName);
    };

    return { getSvg, getPng, exportToPng, exportToSvg, exportToCanvas, exportToClipboard };
};
