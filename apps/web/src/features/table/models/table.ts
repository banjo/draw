import { loadBlockFonts } from "@/features/draw/models/block-fonts";
import { toSvgFile } from "@/features/draw/models/block-image";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { hashString } from "@excalidraw/excalidraw";
import { FileId } from "@excalidraw/excalidraw/element/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { CustomDataTable, ExcalidrawElement, ExcalidrawImageElement } from "common";
import type { TableContent, TableLook } from "./table-render";

export const TABLE_LOOKS: { look: TableLook; label: string }[] = [
    { look: "sketchy", label: "Sketchy" },
    { look: "clean", label: "Clean" },
];

export const MAX_ROWS = 50;
export const MAX_COLUMNS = 12;

const DEFAULT_CONTENT: TableContent = {
    rows: [
        ["Name", "Owner", "Status"],
        ["", "", ""],
        ["", "", ""],
    ],
    look: "sketchy",
    headerRow: true,
    headerColumn: false,
};

// Bumped when the drawing changes, so tables get new images
const IMAGE_VERSION = 1;

/** Every row as long as the longest, and at least one cell */
const normalize = (rows: string[][]) => {
    const columns = Math.max(1, ...rows.map(row => row.length));
    const filled = rows.length > 0 ? rows : [[""]];
    return filled.map(row => Array.from({ length: columns }, (_, i) => row[i] ?? ""));
};

const getContent = (element: ExcalidrawElement): TableContent => {
    const data = element.customData as Partial<CustomDataTable> | undefined;
    return {
        rows: normalize(Array.isArray(data?.rows) ? data.rows : DEFAULT_CONTENT.rows),
        look: data?.look === "clean" ? "clean" : "sketchy",
        headerRow: data?.headerRow ?? true,
        headerColumn: data?.headerColumn ?? false,
    };
};

/** The same content always gets the same id, so every browser can make the file itself */
const getFileId = (content: TableContent) => {
    const key = JSON.stringify(content);
    return `table-${IMAGE_VERSION}-${hashString(key)}-${key.length}` as FileId;
};

/** The table drawn, with its file, size at scale 1, and where its cells are */
const render = async (content: TableContent) => {
    // Loaded with the first table
    const [fonts, { renderTable }] = await Promise.all([
        loadBlockFonts(),
        import("./table-render"),
    ]);
    const { svg, width, height, cells } = renderTable(content, fonts);
    return { file: toSvgFile(svg, getFileId(content)), width, height, cells };
};

const toCustomData = (content: TableContent): CustomDataTable => ({
    shadow: false,
    type: "table",
    ...content,
});

/** A new table at 0,0 with its file */
const create = async (changes: Partial<TableContent> = {}) => {
    const content = {
        ...DEFAULT_CONTENT,
        ...changes,
        rows: normalize(changes.rows ?? DEFAULT_CONTENT.rows),
    };
    const rendered = await render(content);
    const element = ElementCreationUtil.createImage({
        base: { x: 0, y: 0, width: rendered.width, height: rendered.height },
        fileId: rendered.file.id,
        callback: draft => {
            draft.customData = toCustomData(content);
            return draft;
        },
    });
    return { element, ...rendered };
};

/** The table with new content and its new file, at the scale it was resized to */
const update = async (element: ExcalidrawElement, changes: Partial<TableContent>) => {
    const before = getContent(element);
    const after = { ...before, ...changes, rows: normalize(changes.rows ?? before.rows) };
    const [previous, rendered] = await Promise.all([render(before), render(after)]);
    const scale = element.width / previous.width;

    const updated = UpdateElementUtil.updateElement(element, draft => {
        // Keeps what a chart of it had, for when it's a chart again
        draft.customData = { ...draft.customData, ...toCustomData(after) };
        (draft as Mutable<ExcalidrawImageElement>).fileId = rendered.file.id;
        draft.width = rendered.width * scale;
        draft.height = rendered.height * scale;
        return draft;
    });
    return { ...rendered, element: updated, scale };
};

const setCell = (
    rows: string[][],
    { row, column }: { row: number; column: number },
    text: string
) =>
    rows.map((cells, r) =>
        r === row ? cells.map((cell, c) => (c === column ? text : cell)) : cells
    );

const addRow = (rows: string[][], at = rows.length) => {
    const columns = rows[0]?.length ?? 1;
    return [...rows.slice(0, at), Array.from({ length: columns }, () => ""), ...rows.slice(at)];
};

const removeRow = (rows: string[][], at = rows.length - 1) =>
    rows.length > 1 ? rows.filter((_, r) => r !== at) : rows;

const addColumn = (rows: string[][], at = rows[0]?.length ?? 0) =>
    rows.map(cells => [...cells.slice(0, at), "", ...cells.slice(at)]);

const removeColumn = (rows: string[][], at = (rows[0]?.length ?? 1) - 1) =>
    (rows[0]?.length ?? 0) > 1 ? rows.map(cells => cells.filter((_, c) => c !== at)) : rows;

/** Rows copied from a spreadsheet: tab-separated, at least two cells */
const parsePasted = (text: string) => {
    if (!text.includes("\t")) return undefined;
    const rows = text
        .replace(/\r\n?/g, "\n")
        .replace(/\n+$/, "")
        .split("\n")
        .map(line => line.split("\t"));
    if (rows.length > MAX_ROWS || Math.max(...rows.map(row => row.length)) > MAX_COLUMNS)
        return undefined;
    return normalize(rows);
};

export const Table = {
    toCustomData,
    getContent,
    getFileId,
    render,
    create,
    update,
    setCell,
    addRow,
    removeRow,
    addColumn,
    removeColumn,
    parsePasted,
};
