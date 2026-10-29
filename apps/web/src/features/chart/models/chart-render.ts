import { BLOCK_FONTS, BlockFontFiles, getFontFaces } from "@/features/draw/models/block-fonts";
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import { ChartData, parseData } from "./chart-data";

export type ChartLook = "sketchy" | "clean";
export type ChartType = "bar" | "stacked" | "hbar" | "line" | "pie" | "donut";
export type ChartPalette = "default" | "cool" | "warm";

export type ChartContent = {
    /** The first row has the series' names, the first column the labels */
    rows: string[][];
    look: ChartLook;
    chartType: ChartType;
    title: string;
    legend: boolean;
    values: boolean;
    palette: ChartPalette;
};

/** Fills for the sketchy look, Excalidraw's, and colors for the clean one */
export const PALETTES: Record<ChartPalette, { sketchy: string[]; ink: string[]; clean: string[] }> =
    {
        default: {
            sketchy: ["#a5d8ff", "#ffc9c9", "#b2f2bb", "#ffec99", "#d0bfff", "#ffd8a8"],
            ink: ["#1971c2", "#e03131", "#2f9e44", "#f08c00", "#6741d9", "#e8590c"],
            clean: ["#4f7cff", "#f59f3a", "#2fb380", "#e5534b", "#9b6bff", "#22a2c3"],
        },
        cool: {
            sketchy: ["#a5d8ff", "#96f2d7", "#d0bfff", "#99e9f2", "#bac8ff", "#b2f2bb"],
            ink: ["#1971c2", "#099268", "#6741d9", "#0c8599", "#3b5bdb", "#2f9e44"],
            clean: ["#3b6cf6", "#14b8a6", "#8b5cf6", "#06b6d4", "#6366f1", "#22c55e"],
        },
        warm: {
            sketchy: ["#ffc9c9", "#ffd8a8", "#ffec99", "#fcc2d7", "#eebefa", "#ffe8cc"],
            ink: ["#e03131", "#e8590c", "#f08c00", "#c2255c", "#9c36b5", "#d9480f"],
            clean: ["#ef4444", "#f97316", "#eab308", "#ec4899", "#a855f7", "#f59e0b"],
        },
    };

const INK = "#1e1e1e";
const CLEAN = { ink: "#1f2328", muted: "#59636e", grid: "#eaeef2", axis: "#d0d7de" };

export const CHART_SIZE = { width: 480, height: 300 };

const escapeXml = (text: string) =>
    text.replace(
        /[&<>"]/g,
        char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!
    );

type Font = { family: string; size: number; weight?: number };

let context: CanvasRenderingContext2D | undefined;

const measure = (content: string, font: Font) => {
    context ??= document.createElement("canvas").getContext("2d")!;
    context.font = `${font.weight ?? 400} ${font.size}px ${font.family}`;
    return context.measureText(content).width;
};

/** The text cut to fit the width, with "…" when it's cut */
const fit = (content: string, width: number, font: Font) => {
    if (measure(content, font) <= width) return content;
    let end = content.length;
    while (end > 0 && measure(`${content.slice(0, end)}…`, font) > width) end--;
    return end > 0 ? `${content.slice(0, end)}…` : "";
};

/** 1234 as "1.2k", 0.5 as "0.5" */
const format = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1e6) return `${+(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e4) return `${+(value / 1e3).toFixed(1)}k`;
    return String(+value.toFixed(2));
};

/** Round steps between the lowest and highest values, from zero */
const getScale = (low: number, high: number) => {
    const min = Math.min(0, low);
    const max = Math.max(0, high);
    const target = (max - min || 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(target));
    const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= target)!;
    const from = Math.floor(min / step) * step;
    const to = Math.max(Math.ceil(max / step) * step, from + step);
    const ticks: number[] = [];
    for (let t = from; t <= to + step / 2; t += step) ticks.push(+t.toFixed(10));
    return { from, to, ticks };
};

const generator = rough.generator();

type Pen = {
    parts: string[];
    look: ChartLook;
    colors: string[];
    fills: string[];
    inks: string[];
    seed: number;
};

const roughPaths = (pen: Pen, drawable: ReturnType<typeof generator.line>) =>
    generator
        .toPaths(drawable)
        .map(
            path =>
                `<path d="${path.d}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" fill="${path.fill ?? "none"}" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("");

const sketchOptions = (pen: Pen, extra: Options = {}): Options => ({
    seed: pen.seed++,
    roughness: 1,
    strokeWidth: 1.5,
    stroke: INK,
    ...extra,
});

const drawText = (
    pen: Pen,
    content: string,
    {
        x,
        y,
        font,
        fill,
        anchor = "start",
    }: { x: number; y: number; font: Font; fill: string; anchor?: string }
) => {
    if (!content) return;
    const weight = font.weight && font.weight !== 400 ? ` font-weight="${font.weight}"` : "";
    // As wide as measured, so it fits however the font is drawn
    pen.parts.push(
        `<text x="${x}" y="${y}" font-family="${font.family}" font-size="${font.size}"${weight} fill="${fill}" text-anchor="${anchor}" textLength="${measure(content, font)}" lengthAdjust="spacingAndGlyphs" dominant-baseline="central" style="white-space:pre">${escapeXml(content)}</text>`
    );
};

const drawRect = (pen: Pen, [x, y, w, h]: [number, number, number, number], color: number) => {
    if (w <= 0 || h <= 0) return;
    if (pen.look === "clean") {
        pen.parts.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(3, w / 2, h / 2)}" fill="${pen.colors[color % pen.colors.length]}"/>`
        );
        return;
    }
    pen.parts.push(
        roughPaths(
            pen,
            generator.rectangle(
                x,
                y,
                w,
                h,
                sketchOptions(pen, {
                    fill: pen.fills[color % pen.fills.length],
                    fillStyle: "hachure",
                    hachureGap: 5,
                    fillWeight: 1.2,
                })
            )
        )
    );
};

const drawLine = (pen: Pen, [x1, y1, x2, y2]: [number, number, number, number], stroke: string) => {
    if (pen.look === "clean") {
        pen.parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}"/>`);
    } else {
        pen.parts.push(roughPaths(pen, generator.line(x1, y1, x2, y2, sketchOptions(pen))));
    }
};

type Area = { left: number; right: number; top: number; bottom: number };

type Plot = { data: ChartData; area: Area; content: ChartContent };

const fonts = (look: ChartLook) =>
    look === "clean"
        ? {
              title: { family: BLOCK_FONTS.sans, size: 15, weight: 600 },
              label: { family: BLOCK_FONTS.sans, size: 12 },
              small: { family: BLOCK_FONTS.sans, size: 11 },
              text: CLEAN.ink,
              muted: CLEAN.muted,
          }
        : {
              title: { family: BLOCK_FONTS.hand, size: 20 },
              label: { family: BLOCK_FONTS.hand, size: 15 },
              small: { family: BLOCK_FONTS.hand, size: 13 },
              text: INK,
              muted: INK,
          };

// Each name is cut to fit, so the legend fits on its line
const getNameWidth = (names: string[]) =>
    Math.max(24, Math.min(110, (CHART_SIZE.width - 32) / Math.max(names.length, 1) - 31));

const getLegendWidth = (names: string[], font: Font) =>
    names.reduce(
        (sum, name) => sum + measure(fit(name, getNameWidth(names), font), font) + 6 + 11 + 14,
        -14
    );

/** The legend's names and colors, from the right edge */
const drawLegend = (pen: Pen, names: string[], { right, y }: { right: number; y: number }) => {
    const { label, muted } = fonts(pen.look);
    let x = right;
    [...names].reverse().forEach((name, reversed) => {
        const index = names.length - 1 - reversed;
        const shown = fit(name, getNameWidth(names), label);
        drawText(pen, shown, { x, y, font: label, fill: muted, anchor: "end" });
        x -= measure(shown, label) + 6;
        if (pen.look === "clean") drawRect(pen, [x - 11, y - 5.5, 11, 11], index);
        else {
            const fill = pen.fills[index % pen.fills.length];
            pen.parts.push(
                roughPaths(
                    pen,
                    generator.rectangle(
                        x - 12,
                        y - 6,
                        12,
                        12,
                        sketchOptions(pen, { fill, fillStyle: "solid", strokeWidth: 1 })
                    )
                )
            );
        }
        x -= 11 + 14;
    });
};

const drawBars = (pen: Pen, { data, area, content }: Plot) => {
    const f = fonts(pen.look);
    const isHorizontal = content.chartType === "hbar";
    const isStacked = content.chartType === "stacked";
    const all = data.series.flatMap(s => s.values);
    const totals = data.labels.map((_, i) =>
        data.series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)
    );
    const scale = getScale(
        Math.min(...all, 0),
        isStacked ? Math.max(...totals, 0) : Math.max(...all, 0)
    );
    const length = isHorizontal ? area.right - area.left : area.bottom - area.top;
    const toPx = (value: number) => ((value - scale.from) / (scale.to - scale.from)) * length;
    const zero = toPx(0);

    for (const tick of scale.ticks) {
        const at = toPx(tick);
        const label = format(tick);
        if (isHorizontal) {
            const x = area.left + at;
            if (pen.look === "clean")
                drawLine(pen, [x, area.top, x, area.bottom], tick ? CLEAN.grid : CLEAN.axis);
            drawText(pen, label, {
                x,
                y: area.bottom + 14,
                font: f.small,
                fill: f.muted,
                anchor: "middle",
            });
        } else {
            const y = area.bottom - at;
            if (pen.look === "clean")
                drawLine(pen, [area.left, y, area.right, y], tick ? CLEAN.grid : CLEAN.axis);
            drawText(pen, label, {
                x: area.left - 8,
                y,
                font: f.small,
                fill: f.muted,
                anchor: "end",
            });
        }
    }
    if (pen.look === "sketchy") {
        if (isHorizontal) {
            drawLine(pen, [area.left + zero, area.top - 4, area.left + zero, area.bottom], INK);
            drawLine(pen, [area.left, area.bottom, area.right, area.bottom], INK);
        } else {
            drawLine(pen, [area.left, area.top - 4, area.left, area.bottom], INK);
            drawLine(pen, [area.left, area.bottom - zero, area.right, area.bottom - zero], INK);
        }
    }

    const count = Math.max(data.labels.length, 1);
    const slot = (isHorizontal ? area.bottom - area.top : area.right - area.left) / count;
    const group = slot * 0.7;
    const seriesCount = Math.max(data.series.length, 1);
    const bar = isStacked ? group : group / seriesCount;
    const gap = isStacked || seriesCount === 1 ? 0 : Math.min(3, bar * 0.15);

    data.labels.forEach((label, i) => {
        let stacked = 0;
        data.series.forEach((series, j) => {
            const value = series.values[i] ?? 0;
            const start = isStacked ? toPx(stacked) : zero;
            const end = toPx(isStacked ? stacked + Math.max(0, value) : value);
            if (isStacked) stacked += Math.max(0, value);
            const offset = (slot - group) / 2 + (isStacked ? 0 : j * bar);
            const along = Math.min(start, end);
            const size = Math.abs(end - start);
            if (isHorizontal) {
                drawRect(
                    pen,
                    [area.left + along, area.top + i * slot + offset, size, bar - gap],
                    j
                );
            } else {
                drawRect(
                    pen,
                    [area.left + i * slot + offset, area.bottom - along - size, bar - gap, size],
                    j
                );
            }
            if (!content.values || isStacked) return;
            const text = format(value);
            if (isHorizontal) {
                const x = area.left + (value < 0 ? along - 5 : along + size + 5);
                const y = area.top + i * slot + offset + (bar - gap) / 2;
                drawText(pen, text, {
                    x,
                    y,
                    font: f.small,
                    fill: f.text,
                    anchor: value < 0 ? "end" : "start",
                });
            } else {
                const x = area.left + i * slot + offset + (bar - gap) / 2;
                const y = value < 0 ? area.bottom - along + 9 : area.bottom - along - size - 9;
                drawText(pen, fit(text, slot, f.small), {
                    x,
                    y,
                    font: f.small,
                    fill: f.text,
                    anchor: "middle",
                });
            }
        });
        if (isHorizontal) {
            const shown = fit(label, area.left - 18, f.label);
            drawText(pen, shown, {
                x: area.left - 8,
                y: area.top + i * slot + slot / 2,
                font: f.label,
                fill: f.muted,
                anchor: "end",
            });
        } else {
            const shown = fit(label, slot - 4, f.label);
            drawText(pen, shown, {
                x: area.left + i * slot + slot / 2,
                y: area.bottom + 14,
                font: f.label,
                fill: f.muted,
                anchor: "middle",
            });
        }
    });
};

const drawLines = (pen: Pen, { data, area, content }: Plot) => {
    const f = fonts(pen.look);
    const all = data.series.flatMap(s => s.values);
    const scale = getScale(Math.min(...all, 0), Math.max(...all, 0));
    const toY = (value: number) =>
        area.bottom - ((value - scale.from) / (scale.to - scale.from)) * (area.bottom - area.top);
    const count = data.labels.length;
    const inset = 18;
    const toX = (i: number) =>
        count === 1
            ? (area.left + area.right) / 2
            : area.left + inset + (i * (area.right - area.left - inset * 2)) / (count - 1);

    for (const tick of scale.ticks) {
        const y = toY(tick);
        if (pen.look === "clean")
            drawLine(pen, [area.left, y, area.right, y], tick ? CLEAN.grid : CLEAN.axis);
        drawText(pen, format(tick), {
            x: area.left - 8,
            y,
            font: f.small,
            fill: f.muted,
            anchor: "end",
        });
    }
    if (pen.look === "sketchy") {
        drawLine(pen, [area.left, area.top - 4, area.left, area.bottom], INK);
        drawLine(pen, [area.left, toY(0), area.right, toY(0)], INK);
    }
    const slot =
        count > 1 ? (area.right - area.left - inset * 2) / (count - 1) : area.right - area.left;
    data.labels.forEach((label, i) =>
        drawText(pen, fit(label, slot - 4, f.label), {
            x: toX(i),
            y: area.bottom + 14,
            font: f.label,
            fill: f.muted,
            anchor: "middle",
        })
    );

    data.series.forEach((series, j) => {
        const points = series.values.map((value, i) => [toX(i), toY(value)] as [number, number]);
        if (pen.look === "clean") {
            const color = pen.colors[j % pen.colors.length];
            pen.parts.push(
                `<polyline points="${points.map(p => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`,
                ...points.map(
                    ([x, y]) =>
                        `<circle cx="${x}" cy="${y}" r="3.5" fill="#ffffff" stroke="${color}" stroke-width="2"/>`
                )
            );
        } else {
            const ink = pen.inks[j % pen.inks.length]!;
            if (points.length > 1) {
                pen.parts.push(
                    roughPaths(
                        pen,
                        generator.linearPath(
                            points,
                            sketchOptions(pen, { stroke: ink, strokeWidth: 2.2 })
                        )
                    )
                );
            }
            points.forEach(([x, y]) =>
                pen.parts.push(
                    roughPaths(
                        pen,
                        generator.circle(
                            x,
                            y,
                            9,
                            sketchOptions(pen, {
                                stroke: ink,
                                fill: pen.fills[j % pen.fills.length],
                                fillStyle: "solid",
                            })
                        )
                    )
                )
            );
        }
        if (content.values) {
            points.forEach(([x, y], i) =>
                drawText(pen, format(series.values[i] ?? 0), {
                    x,
                    y: y - 14,
                    font: f.small,
                    fill: f.text,
                    anchor: "middle",
                })
            );
        }
    });
};

const drawPie = (pen: Pen, { data, area, content }: Plot) => {
    const f = fonts(pen.look);
    const values = (data.series[0]?.values ?? []).map(value => Math.max(0, value));
    const total = values.reduce((a, b) => a + b, 0);
    const radius = Math.max(10, Math.min(area.right - area.left, area.bottom - area.top) / 2 - 4);
    const cx = (area.left + area.right) / 2;
    const cy = (area.top + area.bottom) / 2;
    const isDonut = content.chartType === "donut";

    if (total <= 0) {
        drawText(pen, "No numbers yet", {
            x: cx,
            y: cy,
            font: f.label,
            fill: f.muted,
            anchor: "middle",
        });
        return;
    }

    let angle = -Math.PI / 2;
    values.forEach((value, i) => {
        if (value <= 0) return;
        const end = angle + (value / total) * Math.PI * 2;
        if (pen.look === "clean") {
            const full = end - angle >= Math.PI * 2 - 1e-6;
            const large = end - angle > Math.PI ? 1 : 0;
            const point = (a: number) =>
                `${cx + radius * Math.cos(a)} ${cy + radius * Math.sin(a)}`;
            pen.parts.push(
                full
                    ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${pen.colors[i % pen.colors.length]}"/>`
                    : `<path d="M${cx} ${cy} L${point(angle)} A${radius} ${radius} 0 ${large} 1 ${point(end)} Z" fill="${pen.colors[i % pen.colors.length]}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>`
            );
        } else {
            pen.parts.push(
                roughPaths(
                    pen,
                    generator.arc(
                        cx,
                        cy,
                        radius * 2,
                        radius * 2,
                        angle,
                        end,
                        true,
                        sketchOptions(pen, {
                            fill: pen.fills[i % pen.fills.length],
                            fillStyle: "hachure",
                            hachureGap: 5,
                            fillWeight: 1.2,
                        })
                    )
                )
            );
        }
        const share = value / total;
        if (content.values && share >= 0.05) {
            const middle = (angle + end) / 2;
            const at = isDonut ? radius * 0.8 : radius * 0.62;
            drawText(pen, `${Math.round(share * 100)}%`, {
                x: cx + at * Math.cos(middle),
                y: cy + at * Math.sin(middle),
                font: { ...f.small, weight: pen.look === "clean" ? 600 : 400 },
                fill: pen.look === "clean" ? "#ffffff" : INK,
                anchor: "middle",
            });
        }
        angle = end;
    });

    if (isDonut) {
        const inner = radius * 0.58;
        if (pen.look === "clean")
            pen.parts.push(`<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#ffffff"/>`);
        else
            pen.parts.push(
                roughPaths(
                    pen,
                    generator.circle(
                        cx,
                        cy,
                        inner * 2,
                        sketchOptions(pen, { fill: "#ffffff", fillStyle: "solid" })
                    )
                )
            );
        const big = { ...f.title, size: f.title.size + 3 };
        drawText(pen, format(total), {
            x: cx,
            y: cy - 6,
            font: big,
            fill: f.text,
            anchor: "middle",
        });
        drawText(pen, fit(data.series[0]?.name ?? "", inner * 1.6, f.small), {
            x: cx,
            y: cy + 14,
            font: f.small,
            fill: f.muted,
            anchor: "middle",
        });
    }
};

/**
 * The title on the left and the legend on the right, on one line when they fit, else the
 * legend under the title. Returns where the plot can start.
 */
const drawHeader = (pen: Pen, data: ChartData, content: ChartContent) => {
    const { width } = CHART_SIZE;
    const f = fonts(content.look);
    const pad = content.look === "clean" ? 16 : 8;
    const isPie = content.chartType === "pie" || content.chartType === "donut";
    const legendNames = isPie ? data.labels : data.series.map(s => s.name);
    const showLegend = content.legend && (isPie || data.series.length > 1);
    const legendWidth = showLegend ? getLegendWidth(legendNames, f.label) : 0;
    const title = fit(content.title.trim(), width - pad * 2, f.title);
    const titleWidth = title ? measure(title, f.title) : 0;
    const sameLine = !title || !showLegend || titleWidth + legendWidth + 16 <= width - pad * 2;
    let y = pad + 12;
    if (title) {
        drawText(pen, title, { x: pad, y, font: f.title, fill: f.text });
        if (!sameLine) y += 26;
    }
    if (showLegend) drawLegend(pen, legendNames, { right: width - pad, y });
    return title || showLegend ? y + 14 : pad;
};

/** The bars, lines or pie, under the header */
const drawPlot = (
    pen: Pen,
    { data, content, top }: { data: ChartData; content: ChartContent; top: number }
) => {
    const { width, height } = CHART_SIZE;
    const f = fonts(content.look);
    const pad = content.look === "clean" ? 16 : 8;

    if (data.series.length === 0 || data.labels.length === 0) {
        drawText(pen, "Add a row and a column of numbers", {
            x: width / 2,
            y: (top + height) / 2,
            font: f.label,
            fill: f.muted,
            anchor: "middle",
        });
        return;
    }
    if (content.chartType === "pie" || content.chartType === "donut") {
        const area = { left: pad, right: width - pad, top: top + 6, bottom: height - pad };
        drawPie(pen, { data, area, content });
        return;
    }

    const isHorizontal = content.chartType === "hbar";
    const all = data.series.flatMap(s => s.values);
    const totals = data.labels.map((_, i) =>
        data.series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)
    );
    const ticks = getScale(Math.min(...all, 0), Math.max(...all, ...totals, 0)).ticks;
    // Room on the left for the labels of horizontal bars, or the numbers of the others
    const leftWidth = isHorizontal
        ? Math.min(110, Math.max(...data.labels.map(l => measure(l, f.label)), 10) + 4)
        : Math.max(...ticks.map(t => measure(format(t), f.small)), 10);
    const area = {
        left: pad + leftWidth + 10,
        right: width - pad - (isHorizontal && content.values ? 28 : 6),
        top: top + (content.values && !isHorizontal ? 22 : 12),
        bottom: height - pad - 24,
    };
    if (content.chartType === "line") drawLines(pen, { data, area, content });
    else drawBars(pen, { data, area, content });
};

/** The chart as an SVG, and its size */
export const renderChart = (content: ChartContent, fontFiles: BlockFontFiles) => {
    const { width, height } = CHART_SIZE;
    const palette = PALETTES[content.palette];
    const pen: Pen = {
        parts: [],
        look: content.look,
        colors: palette.clean,
        fills: palette.sketchy,
        inks: palette.ink,
        seed: 7,
    };
    const data = parseData(content.rows);
    const clean = content.look === "clean";

    if (clean) {
        pen.parts.push(
            `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="#ffffff" stroke="${CLEAN.axis}"/>`
        );
    }

    const top = drawHeader(pen, data, content);
    drawPlot(pen, { data, content, top });

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<defs><style>${getFontFaces(fontFiles, { sans: clean, hand: !clean })}</style></defs>`,
        ...pen.parts,
        "</svg>",
    ].join("");
    return { svg, width, height };
};
