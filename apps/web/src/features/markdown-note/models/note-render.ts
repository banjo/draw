import { marked, Token, Tokens } from "marked";
import rough from "roughjs";
import { NOTE_FONTS, NoteFontFiles } from "./note-fonts";

/** "paper" is clean, like GitHub; "hand" is handwritten in a sketchy box, like the canvas */
export type NoteLook = "paper" | "hand";

export type NoteContent = { markdown: string; look: NoteLook; width: number };

/** Where a checkbox is in the image, by its order in the note */
export type CheckboxBox = { index: number; x: number; y: number; size: number };

/** Where a link's text is in the image, one box per word */
export type LinkBox = { href: string; x: number; y: number; width: number; height: number };

type Theme = {
    family: string;
    size: number;
    lineHeight: number;
    headingSizes: number[];
    headingWeight: number;
    padding: number;
    gap: number;
    text: string;
    muted: string;
    link: string;
    code: string;
    codeBackground: string;
    rule: string;
    check: string;
};

const THEMES: Record<NoteLook, Theme> = {
    paper: {
        family: NOTE_FONTS.sans,
        size: 15,
        lineHeight: 1.5,
        headingSizes: [24, 20, 17, 15, 15, 15],
        headingWeight: 700,
        padding: 18,
        gap: 10,
        text: "#1f2328",
        muted: "#59636e",
        link: "#0969da",
        code: "#1f2328",
        codeBackground: "#eff1f3",
        rule: "#d0d7de",
        check: "#1f883d",
    },
    hand: {
        family: NOTE_FONTS.hand,
        size: 18,
        lineHeight: 1.45,
        headingSizes: [28, 24, 21, 18, 18, 18],
        headingWeight: 400,
        padding: 20,
        gap: 10,
        text: "#1e1e1e",
        muted: "#868e96",
        link: "#1971c2",
        code: "#c2255c",
        codeBackground: "transparent",
        rule: "#1e1e1e",
        check: "#2f9e44",
    },
};

// A monospace character's width, the same everywhere whatever font a browser has
const MONO_CHAR_WIDTH = 0.6;
const INDENT = 24;
const QUOTE_INDENT = 14;
const CHECKBOX_SCALE = 0.95;

type Style = {
    size: number;
    weight: number;
    italic?: boolean;
    code?: boolean;
    link?: boolean;
    href?: string;
    strike?: boolean;
    muted?: boolean;
};

type Piece = { text: string; style: Style; width: number };

type Shape =
    | { kind: "text"; x: number; y: number; piece: Piece }
    | {
          kind: "rect";
          x: number;
          y: number;
          width: number;
          height: number;
          fill: string;
          radius: number;
      }
    | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
    | { kind: "bullet"; x: number; y: number; radius: number; color: string }
    | { kind: "checkbox"; x: number; y: number; size: number; checked: boolean };

const ENTITIES: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
};
const decode = (text: string) =>
    text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ENTITIES[entity]!);

const escapeXml = (text: string) =>
    text.replace(
        /[&<>"]/g,
        char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!
    );

/** Lays out a note: its blocks top to bottom, each line's words wrapped at the width */
class Layout {
    readonly shapes: Shape[] = [];
    readonly checkboxes: CheckboxBox[] = [];
    readonly links: LinkBox[] = [];
    y: number;
    private readonly context = document.createElement("canvas").getContext("2d")!;
    private checkboxCount = 0;

    constructor(
        readonly theme: Theme,
        readonly width: number
    ) {
        this.y = theme.padding;
    }

    private body(extra: Partial<Style> = {}): Style {
        return { size: this.theme.size, weight: 400, ...extra };
    }

    private measure(text: string, style: Style) {
        if (style.code) return text.length * style.size * MONO_CHAR_WIDTH;
        const italic = style.italic && this.theme.family === NOTE_FONTS.sans ? "italic " : "";
        this.context.font = `${italic}${style.weight} ${style.size}px ${this.theme.family}`;
        return this.context.measureText(text).width;
    }

    private piece(text: string, style: Style): Piece {
        return { text, style, width: this.measure(text, style) };
    }

    /** The inline parts of a block as pieces of text with a style each */
    private inline(tokens: Token[] | undefined, style: Style): Piece[] {
        return (tokens ?? []).flatMap((token): Piece[] => {
            switch (token.type) {
                case "strong": {
                    return this.inline(token.tokens, { ...style, weight: 700 });
                }
                case "em": {
                    return this.inline(token.tokens, { ...style, italic: true });
                }
                case "del": {
                    return this.inline(token.tokens, { ...style, strike: true });
                }
                case "link": {
                    return this.inline(token.tokens, { ...style, link: true, href: token.href });
                }
                case "codespan": {
                    return [
                        this.piece(decode(token.text), {
                            ...style,
                            code: true,
                            size: style.size * 0.9,
                        }),
                    ];
                }
                case "br": {
                    return [{ text: "\n", style, width: 0 }];
                }
                case "image": {
                    return [this.piece(decode(token.text), { ...style, muted: true })];
                }
                default: {
                    if ("tokens" in token && token.tokens?.length)
                        return this.inline(token.tokens, style);
                    const text = "text" in token ? String(token.text) : token.raw;
                    return [this.piece(decode(text), style)];
                }
            }
        });
    }

    /** How many of the word's characters fit in the width, at least one */
    private fit(word: Piece, width: number) {
        let cut = word.text.length - 1;
        while (cut > 1 && this.measure(word.text.slice(0, cut), word.style) > width) cut--;
        return cut;
    }

    /** Pieces into lines no wider than the width, each word moved down whole when it can be */
    private wrap(pieces: Piece[], maxWidth: number) {
        const lines: Piece[][] = [[]];
        let lineWidth = 0;

        const push = (piece: Piece) => {
            lines.at(-1)!.push(piece);
            lineWidth += piece.width;
        };
        const newLine = () => {
            lines.push([]);
            lineWidth = 0;
        };

        for (const piece of pieces) {
            if (piece.text === "\n") {
                newLine();
                continue;
            }
            for (const part of piece.text.split(/(\s+)/)) {
                if (!part) continue;
                const isSpace = /^\s+$/.test(part);
                if (isSpace) {
                    // Code keeps its spaces, e.g. indentation
                    if (piece.style.code) push(this.piece(part, piece.style));
                    else if (lineWidth > 0) push(this.piece(" ", piece.style));
                    continue;
                }

                let word = this.piece(part, piece.style);
                if (lineWidth > 0 && lineWidth + word.width > maxWidth) {
                    // No space at the end of a line
                    const line = lines.at(-1)!;
                    if (line.at(-1)?.text === " ") lineWidth -= line.pop()!.width;
                    newLine();
                }
                // Longer than a line: broken where it has to be
                while (word.width > maxWidth && word.text.length > 1) {
                    const cut = this.fit(word, maxWidth - lineWidth);
                    push(this.piece(word.text.slice(0, cut), word.style));
                    newLine();
                    word = this.piece(word.text.slice(cut), word.style);
                }
                push(word);
            }
        }
        return lines.filter((line, i) => line.length > 0 || i === 0);
    }

    /** Wrapped text at x, from the current y. Returns where each line was. */
    private text(pieces: Piece[], x: number, maxWidth: number) {
        const tops: { top: number; height: number }[] = [];
        for (const line of this.wrap(pieces, maxWidth)) {
            const size = Math.max(this.theme.size, ...line.map(piece => piece.style.size));
            const height = size * this.theme.lineHeight;
            const center = this.y + height / 2;
            let left = x;
            for (const piece of line) {
                if (
                    piece.style.code &&
                    this.theme.codeBackground !== "transparent" &&
                    piece.text.trim()
                ) {
                    this.shapes.push({
                        kind: "rect",
                        x: left - 2,
                        y: center - piece.style.size * 0.75,
                        width: piece.width + 4,
                        height: piece.style.size * 1.5,
                        fill: this.theme.codeBackground,
                        radius: 4,
                    });
                }
                this.shapes.push({ kind: "text", x: left, y: center, piece });
                if (piece.style.href) {
                    this.links.push({
                        href: piece.style.href,
                        x: left,
                        y: center - piece.style.size * 0.75,
                        width: piece.width,
                        height: piece.style.size * 1.5,
                    });
                }
                if (piece.style.strike || piece.style.link) {
                    const lineY = piece.style.strike ? center : center + piece.style.size * 0.55;
                    this.shapes.push({
                        kind: "line",
                        x1: left,
                        y1: lineY,
                        x2: left + piece.width,
                        y2: lineY,
                        color: this.color(piece.style),
                        width: piece.style.strike ? 1.2 : 1,
                    });
                }
                left += piece.width;
            }
            tops.push({ top: this.y, height });
            this.y += height;
        }
        return tops;
    }

    color(style: Style) {
        if (style.link) return this.theme.link;
        if (style.muted) return this.theme.muted;
        if (style.code) return this.theme.code;
        return this.theme.text;
    }

    blocks(tokens: Token[], x: number, muted = false) {
        let isFirst = true;
        for (const token of tokens) {
            if (token.type === "space") continue;
            if (!isFirst) this.y += this.theme.gap;
            isFirst = false;
            this.block(token, x, muted);
        }
    }

    private block(token: Token, x: number, muted: boolean) {
        const maxWidth = this.width - this.theme.padding - x;

        switch (token.type) {
            case "heading": {
                const size = this.theme.headingSizes[token.depth - 1] ?? this.theme.size;
                const style = this.body({ size, weight: this.theme.headingWeight, muted });
                this.text(this.inline(token.tokens, style), x, maxWidth);
                return;
            }
            case "list": {
                this.list(token as Tokens.List, x, muted);
                return;
            }
            case "blockquote": {
                const top = this.y;
                this.blocks(token.tokens ?? [], x + QUOTE_INDENT, true);
                this.shapes.push({
                    kind: "rect",
                    x,
                    y: top,
                    width: 3,
                    height: this.y - top,
                    fill: this.theme.rule,
                    radius: 1.5,
                });
                return;
            }
            case "code": {
                const style = this.body({ code: true, size: this.theme.size * 0.88 });
                const pad = 10;
                const top = this.y;
                this.y += pad;
                const lines = decode(token.text)
                    .split("\n")
                    .map(line => this.piece(line, style));
                // One line at a time, so the indentation stays
                const shapesBefore = this.shapes.length;
                for (const line of lines) this.text([line], x + pad, maxWidth - pad * 2);
                this.y += pad;
                this.shapes.splice(shapesBefore, 0, {
                    kind: "rect",
                    x,
                    y: top,
                    width: maxWidth,
                    height: this.y - top,
                    fill:
                        this.theme.codeBackground === "transparent"
                            ? "#f1f3f5"
                            : this.theme.codeBackground,
                    radius: 6,
                });
                return;
            }
            case "hr": {
                const y = this.y + this.theme.size * 0.5;
                this.shapes.push({
                    kind: "line",
                    x1: x,
                    y1: y,
                    x2: x + maxWidth,
                    y2: y,
                    color: this.theme.rule,
                    width: 1,
                });
                this.y += this.theme.size;
                return;
            }
            case "table": {
                const table = token as Tokens.Table;
                const rows = [table.header, ...table.rows];
                rows.forEach((row, i) => {
                    const pieces = row.flatMap((cell, column) => [
                        ...(column > 0 ? [this.piece("  |  ", this.body({ muted: true }))] : []),
                        ...this.inline(
                            cell.tokens,
                            this.body({ weight: i === 0 ? 700 : 400, muted })
                        ),
                    ]);
                    this.text(pieces, x, maxWidth);
                });
                return;
            }
            default: {
                const tokens = "tokens" in token && token.tokens ? token.tokens : undefined;
                const pieces = tokens
                    ? this.inline(tokens, this.body({ muted }))
                    : [
                          this.piece(
                              decode("text" in token ? String(token.text) : token.raw),
                              this.body({ muted })
                          ),
                      ];
                this.text(pieces, x, maxWidth);
            }
        }
    }

    private list(list: Tokens.List, x: number, muted: boolean) {
        const start = Number(list.start) || 1;
        list.items.forEach((item, i) => {
            if (i > 0) this.y += this.theme.gap * 0.3;
            const itemMuted = muted || item.checked === true;
            const top = this.y;
            const lineHeight = this.theme.size * this.theme.lineHeight;
            const center = top + lineHeight / 2;

            if (item.task) {
                const size = this.theme.size * CHECKBOX_SCALE;
                const box = { x: x + 2, y: center - size / 2, size };
                this.shapes.push({ kind: "checkbox", ...box, checked: item.checked === true });
                this.checkboxes.push({ index: this.checkboxCount++, ...box });
            } else if (list.ordered) {
                const marker = this.piece(`${start + i}.`, this.body({ muted: true }));
                this.shapes.push({
                    kind: "text",
                    x: x + INDENT - 6 - marker.width,
                    y: center,
                    piece: marker,
                });
            } else {
                this.shapes.push({
                    kind: "bullet",
                    x: x + INDENT / 2 - 2,
                    y: center,
                    radius: 2.5,
                    color: this.theme.text,
                });
            }

            let isFirst = true;
            for (const child of item.tokens) {
                if (child.type === "space") continue;
                if (!isFirst) this.y += this.theme.gap * 0.3;
                isFirst = false;

                if (child.type === "list") {
                    this.list(child as Tokens.List, x + INDENT, muted);
                    continue;
                }
                const style = this.body({ muted: itemMuted, strike: item.checked === true });
                const pieces =
                    "tokens" in child && child.tokens
                        ? this.inline(child.tokens, style)
                        : [this.piece(decode(child.raw), style)];
                this.text(
                    pieces,
                    x + INDENT + (item.task ? 4 : 0),
                    this.width - this.theme.padding - x - INDENT
                );
            }
            if (isFirst) this.y += lineHeight;
        });
    }
}

const fontFaces = (look: NoteLook, fonts: NoteFontFiles, hasItalic: boolean) =>
    look === "hand"
        ? [`@font-face{font-family:${NOTE_FONTS.hand};src:url(${fonts.hand}) format("woff2")}`]
        : [
              `@font-face{font-family:${NOTE_FONTS.sans};src:url(${fonts.sans}) format("woff2");font-weight:100 900}`,
              ...(hasItalic
                  ? [
                        `@font-face{font-family:${NOTE_FONTS.sans};src:url(${fonts.sansItalic}) format("woff2");font-weight:100 900;font-style:italic}`,
                    ]
                  : []),
          ];

const generator = rough.generator();

const roughPaths = (drawable: ReturnType<typeof generator.rectangle>) =>
    generator
        .toPaths(drawable)
        .map(
            path =>
                `<path d="${path.d}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" fill="${path.fill ?? "none"}" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("");

const drawShape = (shape: Shape, layout: Layout, look: NoteLook): string => {
    const { theme } = layout;
    switch (shape.kind) {
        case "text": {
            const { piece } = shape;
            const { style } = piece;
            const family = style.code ? NOTE_FONTS.mono : theme.family;
            const italic =
                style.italic && theme.family === NOTE_FONTS.sans ? ` font-style="italic"` : "";
            const weight =
                style.weight === 400 || look === "hand" ? "" : ` font-weight="${style.weight}"`;
            // Each run as wide as measured, so it fits however the font is drawn
            return `<text x="${shape.x}" y="${shape.y}" font-family="${family}" font-size="${style.size}"${weight}${italic} fill="${layout.color(style)}" textLength="${piece.width}" lengthAdjust="spacingAndGlyphs" style="white-space:pre">${escapeXml(piece.text)}</text>`;
        }
        case "rect": {
            return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.radius}" fill="${shape.fill}"/>`;
        }
        case "line": {
            return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${shape.color}" stroke-width="${shape.width}"/>`;
        }
        case "bullet": {
            return `<circle cx="${shape.x}" cy="${shape.y}" r="${shape.radius}" fill="${shape.color}"/>`;
        }
        case "checkbox": {
            const { x, y, size, checked } = shape;
            const check = `M${x + size * 0.22} ${y + size * 0.52} L${x + size * 0.42} ${y + size * 0.72} L${x + size * 0.8} ${y + size * 0.3}`;
            if (look === "hand") {
                const options = { seed: 7, roughness: 0.8, strokeWidth: 1.5, stroke: theme.text };
                const box = roughPaths(generator.rectangle(x, y, size, size, options));
                const mark = checked
                    ? roughPaths(
                          generator.path(check, { ...options, stroke: theme.check, strokeWidth: 2 })
                      )
                    : "";
                return box + mark;
            }
            return checked
                ? `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="3.5" fill="${theme.check}"/><path d="${check}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
                : `<rect x="${x + 0.75}" y="${y + 0.75}" width="${size - 1.5}" height="${size - 1.5}" rx="3.5" fill="#fff" stroke="#8c959f" stroke-width="1.5"/>`;
        }
    }
};

const PLACEHOLDER = "Double-click to write in Markdown";

/** The note as an SVG, its size, and where its checkboxes are */
export const renderNote = ({ markdown, look, width }: NoteContent, fonts: NoteFontFiles) => {
    const theme = THEMES[look];
    const layout = new Layout(theme, width);
    const tokens = marked.lexer(markdown.trim() ? markdown : PLACEHOLDER, { gfm: true });
    layout.blocks(tokens, theme.padding, !markdown.trim());
    const height = Math.ceil(layout.y + theme.padding);

    const background =
        look === "paper"
            ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="#ffffff" stroke="${theme.rule}"/>`
            : roughPaths(
                  generator.rectangle(2, 2, width - 4, height - 4, {
                      seed: 3,
                      roughness: 1,
                      strokeWidth: 2,
                      stroke: theme.text,
                  })
              );
    const hasItalic = layout.shapes.some(
        shape => shape.kind === "text" && shape.piece.style.italic
    );

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<defs><style>${fontFaces(look, fonts, hasItalic).join("")}</style></defs>`,
        background,
        `<g dominant-baseline="central">`,
        ...layout.shapes.map(shape => drawShape(shape, layout, look)),
        "</g></svg>",
    ].join("");

    return { svg, width, height, checkboxes: layout.checkboxes, links: layout.links };
};
