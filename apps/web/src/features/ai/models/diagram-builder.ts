import { Chart } from "@/features/chart/models/chart";
import { LinkCard } from "@/features/link-card/models/link-card";
import type { LinkContent } from "@/features/link-card/models/link-card-render";
import { MarkdownNote } from "@/features/markdown-note/models/markdown-note";
import { CodeBlockImage } from "@/features/selected-element-visuals/models/code-block-image";
import { Table } from "@/features/table/models/table";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { BinaryFileData } from "@excalidraw/excalidraw/types";
import {
    BlockNode,
    BuiltDiagram as CommonBuiltDiagram,
    CustomData,
    DiagramBuilder as CommonDiagramBuilder,
    DiagramSpec,
    Drawn,
    ExcalidrawElement,
    NOTE_WIDTHS,
    Point,
    TextMetrics,
    toCodeContent,
} from "common";

export type { Point } from "common";
export type BuiltDiagram = CommonBuiltDiagram<BinaryFileData>;

// Excalifont, which labels are written in, as Excalidraw names it
const FONT = "Excalifont, Xiaolai, Segoe UI Emoji";
const LINE_HEIGHT = 1.25;

let context: CanvasRenderingContext2D | null | undefined;

const getLineWidth = (line: string, fontSize: number) => {
    context ??= document.createElement("canvas").getContext("2d");
    if (!context) return line.length * fontSize * 0.55;
    context.font = `${fontSize}px ${FONT}`;
    return context.measureText(line).width;
};

/** Each line broken before the word that makes it wider than maxWidth */
const wrapLine = (line: string, fontSize: number, maxWidth: number) => {
    const lines: string[] = [];
    let current = "";
    for (const word of line.split(" ")) {
        const next = current ? `${current} ${word}` : word;
        if (current && getLineWidth(next, fontSize) > maxWidth) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    lines.push(current);
    return lines;
};

/** Text measured with the fonts the browser has, like Excalidraw measures it */
const metrics: TextMetrics = {
    measure: (text, fontSize) => {
        const lines = text.split("\n");
        return {
            width: Math.max(...lines.map(line => getLineWidth(line, fontSize)), 0),
            height: lines.length * fontSize * LINE_HEIGHT,
        };
    },
    wrap: (text, fontSize, maxWidth) =>
        text
            .split("\n")
            .flatMap(line => wrapLine(line, fontSize, maxWidth))
            .join("\n"),
};

const fromBlock = ({ element, file }: { element: ExcalidrawElement; file: BinaryFileData }) => ({
    elements: [element],
    files: [file],
    width: element.width,
    height: element.height,
});

/** Blocks drawn with their images, so they have their real size */
const drawBlock = async (
    node: BlockNode,
    getLinkContent?: (url: string) => Promise<LinkContent>
): Promise<Drawn<BinaryFileData>> => {
    switch (node.type) {
        case "code": {
            const content = toCodeContent(node);
            const { width, height } = CodeBlockImage.getNaturalSize(content);
            const element = ElementCreationUtil.createImage({
                base: { x: 0, y: 0, width, height },
                fileId: CodeBlockImage.getFileId(content),
                callback: draft => {
                    draft.customData = CustomData.createCodeblock({ ...content, shadow: false });
                    return draft;
                },
            });
            return {
                elements: [element],
                files: [CodeBlockImage.createFile(element)],
                width,
                height,
            };
        }
        case "note":
            return fromBlock(
                await MarkdownNote.create({
                    markdown: node.markdown,
                    width: NOTE_WIDTHS[node.width ?? "M"],
                })
            );
        case "table":
            return fromBlock(
                await Table.create({
                    rows: node.rows,
                    headerRow: node.headerRow ?? true,
                    headerColumn: node.headerColumn ?? false,
                })
            );
        case "chart":
            return fromBlock(
                await Chart.create({
                    rows: node.rows,
                    chartType: node.chartType,
                    title: node.title ?? "",
                })
            );
        case "link": {
            const content = (await getLinkContent?.(node.url)) ?? {
                url: node.url,
                look: "compact" as const,
            };
            return fromBlock(await LinkCard.create(content));
        }
    }
};

type Options = {
    /** Where nodes that were on the canvas already were, by id: they stay there */
    positions?: Map<string, Point>;
    /** A link card's title and icon, from the API */
    getLinkContent?: (url: string) => Promise<LinkContent>;
};

/** BanjoDraw's shapes, blocks, arrows and frames for a diagram, laid out, measured in the browser */
const build = (spec: DiagramSpec, options: Options = {}): Promise<BuiltDiagram> =>
    CommonDiagramBuilder.build<BinaryFileData>(spec, { ...options, metrics, drawBlock });

export const DiagramBuilder = { build, metrics };
