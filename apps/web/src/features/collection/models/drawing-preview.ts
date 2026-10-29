import { CodeBlockUtil } from "@/features/draw/utils/code-block-util";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { MarkdownNote } from "@/features/markdown-note/models/markdown-note";
import { Table } from "@/features/table/models/table";
import { LinkCard } from "@/features/link-card/models/link-card";
import { Chart } from "@/features/chart/models/chart";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import { exportToSvg } from "@excalidraw/excalidraw";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import { ExcalidrawElement } from "common";

/**
 * An SVG of a saved drawing, for a preview. Code blocks, notes, tables, charts and link cards are drawn
 * from their content, like on the canvas. Uploaded images aren't loaded.
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
        elements.map(async element => {
            const fileId = CodeBlockUtil.getFileId(element);
            if (!fileId) return;
            if (CustomDataUtil.isMarkdownNote(element)) {
                const { file } = await MarkdownNote.render(MarkdownNote.getContent(element));
                files[fileId] = { ...file, id: fileId };
            } else if (CustomDataUtil.isTable(element)) {
                const { file } = await Table.render(Table.getContent(element));
                files[fileId] = { ...file, id: fileId };
            } else if (CustomDataUtil.isChart(element)) {
                const { file } = await Chart.render(Chart.getContent(element));
                files[fileId] = { ...file, id: fileId };
            } else if (CustomDataUtil.isLinkCard(element)) {
                const { file } = await LinkCard.render(LinkCard.getContent(element));
                files[fileId] = { ...file, id: fileId };
            }
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
