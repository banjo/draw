import { loadBlockFonts } from "@/features/draw/models/block-fonts";
import { toSvgFile } from "@/features/draw/models/block-image";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { UpdateElementUtil } from "@/features/draw/utils/update-element-util";
import { Table } from "@/features/table/models/table";
import { CaptureUpdateAction, hashString } from "@excalidraw/excalidraw";
import { FileId } from "@excalidraw/excalidraw/element/types";
import { Mutable } from "@excalidraw/excalidraw/utility-types";
import { CustomDataChart, ExcalidrawApi, ExcalidrawElement, ExcalidrawImageElement } from "common";
import { isNumeric } from "./chart-data";
import type { ChartContent, ChartLook, ChartPalette, ChartType } from "./chart-render";

export const CHART_TYPES: { type: ChartType; label: string }[] = [
    { type: "bar", label: "Bar" },
    { type: "stacked", label: "Stacked bar" },
    { type: "hbar", label: "Horizontal bar" },
    { type: "line", label: "Line" },
    { type: "pie", label: "Pie" },
    { type: "donut", label: "Donut" },
];

export const CHART_LOOKS: { look: ChartLook; label: string }[] = [
    { look: "sketchy", label: "Sketchy" },
    { look: "clean", label: "Clean" },
];

export const CHART_PALETTES: { palette: ChartPalette; label: string }[] = [
    { palette: "default", label: "Excalidraw" },
    { palette: "cool", label: "Cool" },
    { palette: "warm", label: "Warm" },
];

export const MAX_CHART_ROWS = 50;
export const MAX_CHART_COLUMNS = 12;

const DEFAULT_CONTENT: ChartContent = {
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

// Bumped when the drawing changes, so charts get new images
const IMAGE_VERSION = 1;

const TYPES = new Set(CHART_TYPES.map(option => option.type));
const PALETTES = new Set(CHART_PALETTES.map(option => option.palette));

/** Every row as long as the longest, and at least one cell */
const normalize = (rows: string[][]) => {
    const columns = Math.max(1, ...rows.map(row => row.length));
    const filled = rows.length > 0 ? rows : [[""]];
    return filled.map(row => Array.from({ length: columns }, (_, i) => row[i] ?? ""));
};

/** A chart's content, or a table's as a chart, with what it had as a chart before */
/** The value if it's one of the allowed ones, else the fallback */
const oneOf = <T>(allowed: Set<T>, value: T | undefined, fallback: T) =>
    value !== undefined && allowed.has(value) ? value : fallback;

const getContent = (element: ExcalidrawElement): ChartContent => {
    const data = (element.customData ?? {}) as Partial<CustomDataChart>;
    return {
        rows: normalize(Array.isArray(data.rows) ? data.rows : DEFAULT_CONTENT.rows),
        look: data.look === "clean" ? "clean" : "sketchy",
        chartType: oneOf(TYPES, data.chartType, "bar"),
        title: String(data.title ?? ""),
        legend: data.legend ?? true,
        values: data.values ?? true,
        palette: oneOf(PALETTES, data.palette, "default"),
    };
};

/** The same content always gets the same id, so every browser can make the file itself */
const getFileId = (content: ChartContent) => {
    const key = JSON.stringify(content);
    return `chart-${IMAGE_VERSION}-${hashString(key)}-${key.length}` as FileId;
};

/** The chart drawn, with its file and size at scale 1 */
const render = async (content: ChartContent) => {
    const [fonts, { renderChart }] = await Promise.all([
        loadBlockFonts(),
        import("./chart-render"),
    ]);
    const { svg, width, height } = renderChart(content, fonts);
    return { file: toSvgFile(svg, getFileId(content)), width, height };
};

const toCustomData = (content: ChartContent): CustomDataChart => ({
    shadow: false,
    type: "chart",
    ...content,
});

/** A new chart at 0,0 with its file */
const create = async (changes: Partial<ChartContent> = {}) => {
    const content = {
        ...DEFAULT_CONTENT,
        ...changes,
        rows: normalize(changes.rows ?? DEFAULT_CONTENT.rows),
    };
    const { file, width, height } = await render(content);
    const element = ElementCreationUtil.createImage({
        base: { x: 0, y: 0, width, height },
        fileId: file.id,
        callback: draft => {
            draft.customData = toCustomData(content);
            return draft;
        },
    });
    return { element, file };
};

/** The chart with new content and its new file, at the scale it was resized to */
const update = async (element: ExcalidrawElement, changes: Partial<ChartContent>) => {
    const before = getContent(element);
    const after = { ...before, ...changes, rows: normalize(changes.rows ?? before.rows) };
    const [previous, rendered] = await Promise.all([render(before), render(after)]);
    const scale = element.width / previous.width;

    const updated = UpdateElementUtil.updateElement(element, draft => {
        // Keeps what its table had, for when it's a table again
        draft.customData = { ...draft.customData, ...toCustomData(after) };
        (draft as Mutable<ExcalidrawImageElement>).fileId = rendered.file.id;
        draft.width = rendered.width * scale;
        draft.height = rendered.height * scale;
        return draft;
    });
    return { element: updated, file: rendered.file };
};

/** Changes a chart in the drawing, as one undo step */
const apply = async (api: ExcalidrawApi, id: string, changes: Partial<ChartContent>) => {
    const current = api.getSceneElements().find(e => e.id === id);
    if (!current) return;
    const updated = await update(current, changes);
    api.addFiles([updated.file]);
    api.updateScene({
        elements: ElementUtil.mergeElements(api.getSceneElementsIncludingDeleted(), [
            updated.element,
        ]),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
};

/**
 * A table shown as a chart, or a chart as a table, with the same rows, centered where it was.
 * Each keeps the other's settings, so switching back looks the same.
 */
const switchView = async (api: ExcalidrawApi, id: string) => {
    const current = api.getSceneElements().find(e => e.id === id);
    if (!current) return;
    const toChart = current.customData?.type === "table";

    const rendered = toChart
        ? await (async () => {
              const content = { ...getContent(current), rows: Table.getContent(current).rows };
              if (current.customData?.type === "table" && !("chartType" in current.customData)) {
                  // A table that's never been a chart: no title, and its look
                  content.title = "";
                  content.look = Table.getContent(current).look;
              }
              return { ...(await render(content)), customData: toCustomData(content) };
          })()
        : await (async () => {
              const content = { ...Table.getContent(current), rows: getContent(current).rows };
              return { ...(await Table.render(content)), customData: Table.toCustomData(content) };
          })();

    const updated = UpdateElementUtil.updateElement(current, draft => {
        draft.customData = { ...draft.customData, ...rendered.customData };
        (draft as Mutable<ExcalidrawImageElement>).fileId = rendered.file.id;
        draft.x = current.x + (current.width - rendered.width) / 2;
        draft.y = current.y + (current.height - rendered.height) / 2;
        draft.width = rendered.width;
        draft.height = rendered.height;
        return draft;
    });
    api.addFiles([rendered.file]);
    api.updateScene({
        elements: ElementUtil.mergeElements(api.getSceneElementsIncludingDeleted(), [updated]),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
};

/** Whether rows could be a chart: a label column and at least one number after it */
const hasNumbers = (rows: string[][]) =>
    rows.length >= 2 && rows.slice(1).some(row => row.slice(1).some(cell => isNumeric(cell)));

export const Chart = {
    hasNumbers,
    getContent,
    getFileId,
    render,
    create,
    update,
    apply,
    switchView,
    normalize,
};
