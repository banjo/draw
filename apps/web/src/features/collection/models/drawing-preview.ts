import { CodeBlockUtil } from "@/features/draw/utils/code-block-util";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { MarkdownNote } from "@/features/markdown-note/models/markdown-note";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import { exportToSvg } from "@excalidraw/excalidraw";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import { ExcalidrawElement } from "common";

/**
 * An SVG of a saved drawing, for a preview. Code blocks and notes are drawn from their code
 * and Markdown, like on the canvas. Uploaded images aren't loaded.
 */
export const renderDrawingPreview = async (savedElements: unknown[], isDark: boolean) => {
    const elements = (savedElements as ExcalidrawElement[])
        .filter(element => !element.isDeleted)
        .map(element =>
            CustomDataUtil.isCodeBlockElement(element) && CodeBlockUtil.isLegacy(element)
                ? CodeBlockUtil.fromLegacy(element)
                : element
        );
    if (elements.length === 0) return null;

    const files: Record<string, BinaryFileData> = {};
    for (const element of elements) {
        const fileId = CodeBlockUtil.getFileId(element);
        if (fileId && CustomDataUtil.isCodeBlockElement(element)) {
            files[fileId] = CodeBlockImage.createFile({ ...element, fileId });
        }
    }
    await Promise.all(
        elements.filter(CustomDataUtil.isMarkdownNote).map(async element => {
            const fileId = CodeBlockUtil.getFileId(element);
            if (!fileId) return;
            const { file } = await MarkdownNote.render(MarkdownNote.getContent(element));
            files[fileId] = { ...file, id: fileId };
        })
    ).catch(() => undefined);

    const svg = await exportToSvg({
        // @ts-ignore - better local typings
        elements,
        appState: { exportBackground: false, exportWithDarkMode: isDark },
        files,
        exportPadding: 16,
        // The page has Excalidraw's fonts already
        skipInliningFonts: true,
    });
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return svg;
};
