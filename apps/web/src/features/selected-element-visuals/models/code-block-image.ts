import {
    CodeEditorLanguage,
    getCodeBlockSettings,
} from "@/features/selected-element-visuals/models/code-editor-langauges";
import { highlightCode } from "@/features/selected-element-visuals/models/code-highlighting";
import { hashString } from "@excalidraw/excalidraw";
import { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import { FileId } from "@excalidraw/excalidraw/element/types";
import { CustomDataCodeblock, ExcalidrawElement } from "common";

/** What a code block's image is drawn from */
export type CodeBlockContent = {
    code: string;
    language: CodeEditorLanguage;
    fontSize: number;
};

// A fixed character width, so the layout is the same whatever monospace font a browser has
const CHAR_WIDTH = 0.6;
const LINE_HEIGHT = 1.5;
const MIN_COLUMNS = 30;
const TAB = "    ";
const PLACEHOLDER = "Double-click to add code";
// Bumped when the drawing changes, so code blocks get new images
const IMAGE_VERSION = 1;

export const CODE_BLOCK_FONT_FAMILY =
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// GitHub's light theme. Excalidraw's dark mode inverts SVG images like the rest of the
// canvas, which makes it dark.
export const CODE_BLOCK_COLORS = {
    background: "#f6f8fa",
    border: "#d0d7de",
    text: "#1f2328",
    placeholder: "#8c959f",
};

const TOKEN_COLORS: Record<string, string> = {
    comment: "#6e7781",
    prolog: "#6e7781",
    doctype: "#6e7781",
    cdata: "#6e7781",
    keyword: "#cf222e",
    atrule: "#cf222e",
    important: "#cf222e",
    rule: "#cf222e",
    deleted: "#82071e",
    string: "#0a3069",
    char: "#0a3069",
    "attr-value": "#0a3069",
    regex: "#0a3069",
    url: "#0a3069",
    number: "#0550ae",
    boolean: "#0550ae",
    constant: "#0550ae",
    symbol: "#0550ae",
    property: "#0550ae",
    "attr-name": "#0550ae",
    operator: "#0550ae",
    title: "#0550ae",
    function: "#8250df",
    "class-name": "#953800",
    builtin: "#953800",
    variable: "#953800",
    namespace: "#953800",
    tag: "#116329",
    selector: "#116329",
    inserted: "#116329",
};

type Token = { text: string; color: string };

const normalize = (code: string) => code.replace(/\r\n?/g, "\n").replace(/\t/g, TAB);

/** The code split into lines of colored tokens */
const toLines = (code: string, language: CodeEditorLanguage): Token[][] => {
    const lines: Token[][] = [[]];

    for (const { text, types } of highlightCode(code, language)) {
        const color = types.map(type => TOKEN_COLORS[type]).find(Boolean) ?? CODE_BLOCK_COLORS.text;

        text.split("\n").forEach((part, index) => {
            if (index > 0) lines.push([]);
            if (part) lines.at(-1)!.push({ text: part, color });
        });
    }

    return lines;
};

const escapeXml = (text: string) =>
    text.replace(
        /[&<>"]/g,
        char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!
    );

const getMetrics = (fontSize: number) => ({
    charWidth: fontSize * CHAR_WIDTH,
    lineHeight: fontSize * LINE_HEIGHT,
    padding: fontSize,
});

/** The size of the image at scale 1 */
const getNaturalSize = ({ code, fontSize }: CodeBlockContent) => {
    const lines = normalize(code).split("\n");
    const columns = Math.max(MIN_COLUMNS, ...lines.map(line => line.length));
    const { charWidth, lineHeight, padding } = getMetrics(fontSize);

    return {
        width: padding * 2 + columns * charWidth,
        height: padding * 2 + lines.length * lineHeight,
    };
};

const renderSvg = (content: CodeBlockContent) => {
    const { fontSize, language } = content;
    const code = normalize(content.code);
    const { width, height } = getNaturalSize(content);
    const { charWidth, lineHeight, padding } = getMetrics(fontSize);
    const lineY = (line: number) => padding + line * lineHeight + lineHeight / 2;

    const texts: string[] = [];
    type Placed = { text: string; column: number; line: number; color: string };
    const addText = ({ text, column, line, color }: Placed) => {
        // Each run of non-spaces at its own column: SVG images don't keep leading spaces
        for (const match of text.matchAll(/\S+/g)) {
            const run = match[0];
            const x = padding + (column + match.index) * charWidth;
            const length = run.length * charWidth;
            texts.push(
                `<text x="${x}" y="${lineY(line)}" fill="${color}" textLength="${length}" lengthAdjust="spacing">${escapeXml(run)}</text>`
            );
        }
    };

    if (code.trim()) {
        toLines(code, language).forEach((tokens, line) => {
            let column = 0;
            tokens.forEach(({ text, color }) => {
                addText({ text, column, line, color });
                column += text.length;
            });
        });
    } else {
        addText({ text: PLACEHOLDER, column: 0, line: 0, color: CODE_BLOCK_COLORS.placeholder });
    }

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${fontSize * 0.5}" fill="${CODE_BLOCK_COLORS.background}" stroke="${CODE_BLOCK_COLORS.border}"/>`,
        `<g font-family="${CODE_BLOCK_FONT_FAMILY}" font-size="${fontSize}" dominant-baseline="central">`,
        ...texts,
        "</g></svg>",
    ].join("");
};

const toBase64 = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(byte => (binary += String.fromCharCode(byte)));
    return btoa(binary);
};

const getContent = (element: ExcalidrawElement): CodeBlockContent => {
    const { language, fontSize } = getCodeBlockSettings(element.customData);
    const code = (element.customData as CustomDataCodeblock | undefined)?.code ?? "";
    return { code, language, fontSize };
};

/** The same content always gets the same id, so every browser can make the file itself */
const getFileId = ({ code, language, fontSize }: CodeBlockContent) =>
    `codeblock-${IMAGE_VERSION}-${hashString(`${language}\n${fontSize}\n${code}`)}-${code.length}` as FileId;

/** The image file for a code block element, under the element's file id */
const createFile = (element: ExcalidrawElement & { fileId: FileId | null }): BinaryFileData => ({
    id: element.fileId ?? getFileId(getContent(element)),
    mimeType: "image/svg+xml",
    dataURL: `data:image/svg+xml;base64,${toBase64(renderSvg(getContent(element)))}` as DataURL,
    created: Date.now(),
});

export const CodeBlockImage = {
    getContent,
    getNaturalSize,
    getFileId,
    getMetrics,
    createFile,
    renderSvg,
};
