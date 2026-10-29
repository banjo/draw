import { BLOCK_FONTS, BlockFontFiles, getFontFaces } from "@/features/draw/models/block-fonts";
import rough from "roughjs";

/** "sketchy" is drawn like the canvas, "clean" with straight lines, like GitHub */
export type TableLook = "sketchy" | "clean";

export type TableContent = {
    /** Every row has the same number of cells */
    rows: string[][];
    look: TableLook;
    headerRow: boolean;
    headerColumn: boolean;
};

/** Where a cell is in the image */
export type CellBox = {
    row: number;
    column: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

type Theme = {
    family: string;
    size: number;
    lineHeight: number;
    paddingX: number;
    paddingY: number;
    minWidth: number;
    maxWidth: number;
    headerWeight: number;
    text: string;
    line: string;
    header: string;
};

export const TABLE_THEMES: Record<TableLook, Theme> = {
    sketchy: {
        family: BLOCK_FONTS.hand,
        size: 18,
        lineHeight: 1.3,
        paddingX: 12,
        paddingY: 10,
        minWidth: 80,
        maxWidth: 260,
        headerWeight: 400,
        text: "#1e1e1e",
        line: "#1e1e1e",
        header: "#a5d8ff",
    },
    clean: {
        family: BLOCK_FONTS.sans,
        size: 14,
        lineHeight: 1.45,
        paddingX: 12,
        paddingY: 9,
        minWidth: 80,
        maxWidth: 260,
        headerWeight: 600,
        text: "#1f2328",
        line: "#d0d7de",
        header: "#f6f8fa",
    },
};

const escapeXml = (text: string) =>
    text.replace(
        /[&<>"]/g,
        char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!
    );

const context = () => document.createElement("canvas").getContext("2d")!;

/** A cell's text in lines no wider than the width, each word moved down whole when it can be */
const wrap = (text: string, width: number, measure: (text: string) => number) =>
    text.split("\n").flatMap(paragraph => {
        const lines: string[] = [];
        let line = "";
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word;
            if (line && measure(next) > width) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        }
        lines.push(line);
        return lines;
    });

const isHeader = (content: TableContent, row: number, column: number) =>
    (content.headerRow && row === 0) || (content.headerColumn && column === 0);

/** Where each column and row goes, and each cell's lines */
const layOut = (content: TableContent) => {
    const theme = TABLE_THEMES[content.look];
    const ctx = context();
    const measure = (text: string, header: boolean) => {
        ctx.font = `${header ? theme.headerWeight : 400} ${theme.size}px ${theme.family}`;
        return ctx.measureText(text).width;
    };
    const columns = Math.max(...content.rows.map(row => row.length), 1);
    const lineHeight = theme.size * theme.lineHeight;

    const widths = Array.from({ length: columns }, (_, column) => {
        const widest = Math.max(
            0,
            ...content.rows.flatMap((row, r) =>
                (row[column] ?? "")
                    .split("\n")
                    .map(line => measure(line, isHeader(content, r, column)))
            )
        );
        return Math.min(
            Math.max(Math.ceil(widest) + theme.paddingX * 2, theme.minWidth),
            theme.maxWidth
        );
    });

    const lines = content.rows.map((row, r) =>
        widths.map((width, column) => {
            const header = isHeader(content, r, column);
            return wrap(row[column] ?? "", width - theme.paddingX * 2, text =>
                measure(text, header)
            ).map(text => ({ text, width: measure(text, header) }));
        })
    );
    const heights = lines.map(
        row => Math.max(...row.map(cell => cell.length), 1) * lineHeight + theme.paddingY * 2
    );

    const xs = widths.map((_, i) => widths.slice(0, i).reduce((a, b) => a + b, 0));
    const ys = heights.map((_, i) => heights.slice(0, i).reduce((a, b) => a + b, 0));
    const width = widths.reduce((a, b) => a + b, 0);
    const height = heights.reduce((a, b) => a + b, 0);

    const cells: CellBox[] = lines.flatMap((row, r) =>
        row.map((_, column) => ({
            row: r,
            column,
            x: xs[column]!,
            y: ys[r]!,
            width: widths[column]!,
            height: heights[r]!,
        }))
    );

    return { theme, lines, lineHeight, xs, ys, widths, heights, width, height, cells };
};

const generator = rough.generator();

const roughPaths = (drawable: ReturnType<typeof generator.rectangle>) =>
    generator
        .toPaths(drawable)
        .map(
            path =>
                `<path d="${path.d}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" fill="${path.fill ?? "none"}" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("");

// Room around the table for the sketchy lines, which wander a little
const MARGIN = 3;

/** The table as an SVG, its size, and where its cells are */
export const renderTable = (content: TableContent, fonts: BlockFontFiles) => {
    const layout = layOut(content);
    const { theme, xs, ys, widths, heights, lineHeight } = layout;
    const width = layout.width + MARGIN * 2;
    const height = layout.height + MARGIN * 2;
    const right = layout.width;
    const bottom = layout.height;
    const parts: string[] = [];
    const sketchy = content.look === "sketchy";

    // The header cells' backgrounds
    const headers: [number, number, number, number][] = [];
    if (content.headerRow) headers.push([0, 0, right, heights[0] ?? 0]);
    if (content.headerColumn) {
        const top = content.headerRow ? (heights[0] ?? 0) : 0;
        headers.push([0, top, widths[0] ?? 0, bottom - top]);
    }

    if (sketchy) {
        headers.forEach(([x, y, w, h], i) =>
            parts.push(
                roughPaths(
                    generator.rectangle(x, y, w, h, {
                        seed: 11 + i,
                        stroke: "none",
                        fill: theme.header,
                        fillStyle: "hachure",
                        hachureGap: 7,
                        fillWeight: 1,
                    })
                )
            )
        );
        // Header lines are thicker, like the outline
        const line = (points: [number, number, number, number], seed: number, strong: boolean) =>
            roughPaths(
                generator.line(...points, {
                    seed,
                    roughness: 1,
                    strokeWidth: strong ? 2 : 1,
                    stroke: theme.line,
                })
            );
        ys.slice(1).forEach((y, i) =>
            parts.push(line([0, y, right, y], 20 + i, content.headerRow && i === 0))
        );
        xs.slice(1).forEach((x, i) =>
            parts.push(line([x, 0, x, bottom], 60 + i, content.headerColumn && i === 0))
        );
        parts.push(
            roughPaths(
                generator.rectangle(0, 0, right, bottom, {
                    seed: 5,
                    roughness: 1,
                    strokeWidth: 2,
                    stroke: theme.line,
                })
            )
        );
    } else {
        parts.push(
            `<clipPath id="table"><rect width="${right}" height="${bottom}" rx="6"/></clipPath>`
        );
        parts.push(
            `<g clip-path="url(#table)"><rect width="${right}" height="${bottom}" fill="#ffffff"/>`
        );
        headers.forEach(([x, y, w, h]) =>
            parts.push(
                `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${theme.header}"/>`
            )
        );
        ys.slice(1).forEach(y =>
            parts.push(`<line x1="0" y1="${y}" x2="${right}" y2="${y}" stroke="${theme.line}"/>`)
        );
        xs.slice(1).forEach(x =>
            parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${bottom}" stroke="${theme.line}"/>`)
        );
        parts.push(
            `</g><rect x="0.5" y="0.5" width="${right - 1}" height="${bottom - 1}" rx="6" fill="none" stroke="${theme.line}"/>`
        );
    }

    layout.lines.forEach((row, r) =>
        row.forEach((cell, column) => {
            const header = isHeader(content, r, column);
            const weight =
                header && theme.headerWeight !== 400 ? ` font-weight="${theme.headerWeight}"` : "";
            cell.forEach((line, i) => {
                if (!line.text) return;
                const x = xs[column]! + theme.paddingX;
                const y = ys[r]! + theme.paddingY + lineHeight * i + lineHeight / 2;
                // As wide as measured, so it fits however the font is drawn
                parts.push(
                    `<text x="${x}" y="${y}"${weight} textLength="${line.width}" lengthAdjust="spacingAndGlyphs" style="white-space:pre">${escapeXml(line.text)}</text>`
                );
            });
        })
    );

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-MARGIN} ${-MARGIN} ${width} ${height}">`,
        `<defs><style>${getFontFaces(fonts, { sans: !sketchy, hand: sketchy })}</style></defs>`,
        `<g font-family="${theme.family}" font-size="${theme.size}" fill="${theme.text}" dominant-baseline="central">`,
        ...parts,
        "</g></svg>",
    ].join("");

    // Cells in the image's coordinates, which start at the margin
    const cells = layout.cells.map(cell => ({ ...cell, x: cell.x + MARGIN, y: cell.y + MARGIN }));
    return { svg, width, height, cells };
};
