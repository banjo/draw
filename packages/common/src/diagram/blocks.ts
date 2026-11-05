import {
    CustomDataChart,
    CustomDataCodeblock,
    CustomDataLink,
    CustomDataMarkdown,
    CustomDataTable,
} from "../model/excalidraw-custom-data";
import { ExcalidrawElement } from "../model/excalidraw-element";
import { hashString } from "./hash-string";

/**
 * What blocks are made of: notes, tables, charts, link cards and code blocks are images drawn
 * from their customData. Every browser draws them itself, under a file id made from the
 * content, so the API can make blocks without drawing them.
 */

// Bumped when a block's drawing changes, so it gets new images
const IMAGE_VERSION = 1;

export const NOTE_WIDTHS = { S: 260, M: 340, L: 460 } as const;

export type NoteLook = "paper" | "hand";
export type NoteContent = { markdown: string; look: NoteLook; width: number };

export type TableLook = "sketchy" | "clean";
export type TableContent = {
    rows: string[][];
    look: TableLook;
    headerRow: boolean;
    headerColumn: boolean;
};

export type ChartLook = "sketchy" | "clean";
export type ChartType = "bar" | "stacked" | "hbar" | "line" | "pie" | "donut";
export type ChartPalette = "default" | "cool" | "warm";
export type ChartContent = {
    rows: string[][];
    look: ChartLook;
    chartType: ChartType;
    title: string;
    legend: boolean;
    values: boolean;
    palette: ChartPalette;
};

export type LinkLook = "compact" | "chip" | "sketchy";
export type LinkContent = {
    url: string;
    title?: string;
    description?: string;
    siteName?: string;
    /** A small PNG data URL */
    icon?: string;
    look: LinkLook;
};

export const CODE_EDITOR_LANGUAGES = [
    "TypeScript",
    "JavaScript",
    "CSS",
    "LESS",
    "SCSS",
    "JSON",
    "HTML",
    "XML",
    "PHP",
    "C#",
    "C++",
    "Razor",
    "Markdown",
    "Diff",
    "Java",
    "VB",
    "CoffeeScript",
    "Handlebars",
    "Batch",
    "Pug",
    "F#",
    "Lua",
    "Powershell",
    "Python",
    "Ruby",
    "SASS",
    "R",
    "Objective-C",
] as const;

export type CodeEditorLanguage = (typeof CODE_EDITOR_LANGUAGES)[number];
export const DEFAULT_CODE_EDITOR_LANGUAGE = "JavaScript" as const;
export const DEFAULT_CODE_EDITOR_FONT_SIZE = 14;

export type CodeBlockContent = { code: string; language: CodeEditorLanguage; fontSize: number };

export const TABLE_DEFAULT_CONTENT: TableContent = {
    rows: [
        ["Name", "Owner", "Status"],
        ["", "", ""],
        ["", "", ""],
    ],
    look: "sketchy",
    headerRow: true,
    headerColumn: false,
};

export const CHART_DEFAULT_CONTENT: ChartContent = {
    rows: [
        ["", "Web", "Mobile"],
        ["Q1", "42", "18"],
        ["Q2", "58", "30"],
        ["Q3", "71", "52"],
        ["Q4", "90", "66"],
    ],
    look: "sketchy",
    chartType: "bar",
    title: "Signups per quarter",
    legend: true,
    values: true,
    palette: "default",
};

const CHART_TYPES = new Set<ChartType>(["bar", "stacked", "hbar", "line", "pie", "donut"]);
const CHART_PALETTES = new Set<ChartPalette>(["default", "cool", "warm"]);
const LINK_LOOKS = new Set<LinkLook>(["compact", "chip", "sketchy"]);

/** The value if it's one of the allowed ones, else the fallback */
const oneOf = <T>(allowed: Set<T>, value: T | undefined, fallback: T) =>
    value !== undefined && allowed.has(value) ? value : fallback;

/** Every row as long as the longest, and at least one cell */
const normalizeRows = (rows: string[][]) => {
    const columns = Math.max(1, ...rows.map(row => row.length));
    const filled = rows.length > 0 ? rows : [[""]];
    return filled.map(row => Array.from({ length: columns }, (_, i) => row[i] ?? ""));
};

const isCodeEditorLanguage = (language: unknown): language is CodeEditorLanguage =>
    CODE_EDITOR_LANGUAGES.includes(language as CodeEditorLanguage);

/** The language and font size of a code block, stored on the element */
const getCodeBlockSettings = (customData: unknown) => {
    const codeblock = customData as Partial<CustomDataCodeblock> | undefined;
    const language = codeblock?.language;
    return {
        language: isCodeEditorLanguage(language) ? language : DEFAULT_CODE_EDITOR_LANGUAGE,
        fontSize: codeblock?.fontSize ?? DEFAULT_CODE_EDITOR_FONT_SIZE,
    };
};

const note = (element: ExcalidrawElement): NoteContent => {
    const data = element.customData as Partial<CustomDataMarkdown> | undefined;
    return {
        markdown: data?.markdown ?? "",
        look: data?.look === "hand" ? "hand" : "paper",
        width: data?.width ?? NOTE_WIDTHS.M,
    };
};

const table = (element: ExcalidrawElement): TableContent => {
    const data = element.customData as Partial<CustomDataTable> | undefined;
    return {
        rows: normalizeRows(Array.isArray(data?.rows) ? data.rows : TABLE_DEFAULT_CONTENT.rows),
        look: data?.look === "clean" ? "clean" : "sketchy",
        headerRow: data?.headerRow ?? true,
        headerColumn: data?.headerColumn ?? false,
    };
};

const chart = (element: ExcalidrawElement): ChartContent => {
    const data = (element.customData ?? {}) as Partial<CustomDataChart>;
    return {
        rows: normalizeRows(Array.isArray(data.rows) ? data.rows : CHART_DEFAULT_CONTENT.rows),
        look: data.look === "clean" ? "clean" : "sketchy",
        chartType: oneOf(CHART_TYPES, data.chartType, "bar"),
        title: String(data.title ?? ""),
        legend: data.legend ?? true,
        values: data.values ?? true,
        palette: oneOf(CHART_PALETTES, data.palette, "default"),
    };
};

const link = (element: ExcalidrawElement): LinkContent => {
    const data = element.customData as Partial<CustomDataLink> | undefined;
    return {
        url: data?.url ?? "",
        title: data?.title,
        description: data?.description,
        siteName: data?.siteName,
        icon: data?.icon,
        look: data?.look && LINK_LOOKS.has(data.look) ? data.look : "compact",
    };
};

const code = (element: ExcalidrawElement): CodeBlockContent => {
    const { language, fontSize } = getCodeBlockSettings(element.customData);
    const data = element.customData as Partial<CustomDataCodeblock> | undefined;
    return { code: data?.code ?? "", language, fontSize };
};

/** A block's content, read from its element */
export const BlockContent = {
    note,
    table,
    chart,
    link,
    code,
    normalizeRows,
    getCodeBlockSettings,
    isCodeEditorLanguage,
};

const fromJson = (prefix: string, key: string) =>
    `${prefix}-${IMAGE_VERSION}-${hashString(key)}-${key.length}`;

/** The same content always gets the same file id, so every browser can make the file itself */
export const BlockFileId = {
    note: ({ markdown, look, width }: NoteContent) =>
        `markdown-${IMAGE_VERSION}-${hashString(`${look}\n${width}\n${markdown}`)}-${markdown.length}`,
    table: ({ rows, look, headerRow, headerColumn }: TableContent) =>
        fromJson("table", JSON.stringify({ rows, look, headerRow, headerColumn })),
    chart: ({ rows, look, chartType, title, legend, values, palette }: ChartContent) =>
        fromJson(
            "chart",
            JSON.stringify({ rows, look, chartType, title, legend, values, palette })
        ),
    link: ({ url, title, description, siteName, icon, look }: LinkContent) =>
        fromJson("link", JSON.stringify({ url, title, description, siteName, icon, look })),
    code: ({ code: text, language, fontSize }: CodeBlockContent) =>
        `codeblock-${IMAGE_VERSION}-${hashString(`${language}\n${fontSize}\n${text}`)}-${text.length}`,
};

// A fixed character width, so the layout is the same whatever monospace font a browser has
const CODE_CHAR_WIDTH = 0.6;
const CODE_LINE_HEIGHT = 1.5;
const CODE_MIN_COLUMNS = 30;
const TAB = "    ";

const normalizeCode = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\t/g, TAB);

const getCodeMetrics = (fontSize: number) => ({
    charWidth: fontSize * CODE_CHAR_WIDTH,
    lineHeight: fontSize * CODE_LINE_HEIGHT,
    padding: fontSize,
});

/** A code block's image size at scale 1 */
const getCodeSize = ({ code: text, fontSize }: CodeBlockContent) => {
    const lines = normalizeCode(text).split("\n");
    const columns = Math.max(CODE_MIN_COLUMNS, ...lines.map(line => line.length));
    const { charWidth, lineHeight, padding } = getCodeMetrics(fontSize);
    return {
        width: padding * 2 + columns * charWidth,
        height: padding * 2 + lines.length * lineHeight,
    };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * About how big a block's image is, without drawing it. A browser draws it and fixes the size
 * when it's shown, as `unmeasured` blocks are.
 */
const estimate = {
    note: ({ markdown, width }: NoteContent) => {
        const charsPerLine = Math.max(1, Math.floor((width - 40) / 8));
        const lines = markdown
            .split("\n")
            .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
        return { width, height: Math.round(40 + lines * 24) };
    },
    table: ({ rows }: TableContent) => {
        const columns = rows[0]?.length ?? 1;
        const widths = Array.from({ length: columns }, (_, i) =>
            clamp(Math.max(...rows.map(row => (row[i] ?? "").length)) * 9 + 28, 60, 260)
        );
        return { width: widths.reduce((a, b) => a + b, 0) + 6, height: rows.length * 38 + 6 };
    },
    chart: () => ({ width: 480, height: 300 }),
    link: ({ look }: LinkContent) =>
        look === "chip" ? { width: 220, height: 36 } : { width: 340, height: 62 },
};

export const BlockSize = { code: getCodeSize, getCodeMetrics, normalizeCode, estimate };
