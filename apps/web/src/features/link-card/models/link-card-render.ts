import { BLOCK_FONTS, BlockFontFiles, getFontFaces } from "@/features/draw/models/block-fonts";
import rough from "roughjs";

/** "compact" is a card with the icon, title and site; "chip" one line; "sketchy" hand-drawn text */
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

const COLORS = {
    text: "#1f2328",
    muted: "#59636e",
    border: "#d0d7de",
    iconBackground: "#f6f8fa",
    hand: "#1e1e1e",
    handMuted: "#495057",
    handLink: "#1971c2",
};

// Colors for the letter shown when a site has no icon, picked by its name
const LETTER_COLORS = ["#1971c2", "#2f9e44", "#e8590c", "#9c36b5", "#c2255c", "#0c8599", "#5f3dc4"];

const escapeXml = (text: string) =>
    text.replace(
        /[&<>"]/g,
        char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!
    );

/** The host without "www.", e.g. "github.com" */
export const getDomain = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

/** The address without its scheme, e.g. "github.com/banjo/draw" */
const getAddress = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

type Font = { family: string; size: number; weight?: number };

let context: CanvasRenderingContext2D | undefined;

const measure = (content: string, font: Font) => {
    context ??= document.createElement("canvas").getContext("2d")!;
    context.font = `${font.weight ?? 400} ${font.size}px ${font.family}`;
    return context.measureText(content).width;
};

/** The text cut to fit the width, with "…" when it's cut */
const fit = (text: string, width: number, font: Font) => {
    if (measure(text, font) <= width) return text;
    let end = text.length;
    while (end > 0 && measure(`${text.slice(0, end).trimEnd()}…`, font) > width) end--;
    return `${text.slice(0, end).trimEnd()}…`;
};

/** The text in at most `maxLines` lines no wider than the width, the last cut with "…" */
const wrap = (
    text: string,
    { width, font, maxLines }: { width: number; font: Font; maxLines: number }
) => {
    const lines: string[] = [];
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    for (let i = 0; i < words.length; i++) {
        const next = line ? `${line} ${words[i]}` : words[i]!;
        if (line && measure(next, font) > width) {
            if (lines.length === maxLines - 1) {
                lines.push(fit(words.slice(i - line.split(" ").length).join(" "), width, font));
                return lines;
            }
            lines.push(line);
            line = words[i]!;
        } else {
            line = next;
        }
    }
    if (line) lines.push(fit(line, width, font));
    return lines;
};

const text = (
    content: string,
    { x, y, font, fill }: { x: number; y: number; font: Font; fill: string }
) => {
    const weight = font.weight && font.weight !== 400 ? ` font-weight="${font.weight}"` : "";
    // As wide as measured, so it fits however the font is drawn
    return `<text x="${x}" y="${y}" font-family="${font.family}" font-size="${font.size}"${weight} fill="${fill}" textLength="${measure(content, font)}" lengthAdjust="spacingAndGlyphs" dominant-baseline="central" style="white-space:pre">${escapeXml(content)}</text>`;
};

/** The site's icon, or its first letter on a color, in a rounded square */
const icon = (
    content: LinkContent,
    {
        x,
        y,
        size,
        radius,
        padding,
    }: { x: number; y: number; size: number; radius: number; padding: number }
) => {
    const domain = getDomain(content.url);
    if (content.icon) {
        const id = `icon-${x}-${y}`;
        return [
            padding > 0
                ? `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${COLORS.iconBackground}" stroke="${COLORS.border}" stroke-width="0.5"/>`
                : "",
            `<clipPath id="${id}"><rect x="${x + padding}" y="${y + padding}" width="${size - padding * 2}" height="${size - padding * 2}" rx="${padding > 0 ? 3 : radius}"/></clipPath>`,
            `<image href="${content.icon}" x="${x + padding}" y="${y + padding}" width="${size - padding * 2}" height="${size - padding * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid meet"/>`,
        ].join("");
    }

    const letter = (content.siteName ?? domain).trim().charAt(0).toUpperCase() || "?";
    const hash = [...domain].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const font = { family: BLOCK_FONTS.sans, size: Math.round(size * 0.45), weight: 800 };
    const width = measure(letter, font);
    return [
        `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${LETTER_COLORS[hash % LETTER_COLORS.length]}"/>`,
        text(letter, { x: x + (size - width) / 2, y: y + size / 2, font, fill: "#ffffff" }),
    ].join("");
};

type Rendered = {
    width: number;
    height: number;
    parts: string[];
    fonts: { sans?: boolean; hand?: boolean };
};

const renderCompact = (content: LinkContent): Rendered => {
    const width = 340;
    const padding = 14;
    const iconSize = 36;
    const height = 62;
    const textX = padding + iconSize + 12;
    const textWidth = width - textX - padding;
    const titleFont = { family: BLOCK_FONTS.sans, size: 14, weight: 600 };
    const siteFont = { family: BLOCK_FONTS.sans, size: 12 };
    const domain = getDomain(content.url);
    const title = content.title ?? content.siteName ?? domain;
    // Without a title, the domain is the title, and the address under it says more
    const subtitle = title === domain ? getAddress(content.url) : domain;

    return {
        width,
        height,
        fonts: { sans: true },
        parts: [
            `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="#ffffff" stroke="${COLORS.border}"/>`,
            icon(content, {
                x: padding,
                y: (height - iconSize) / 2,
                size: iconSize,
                radius: 9,
                padding: 6,
            }),
            text(fit(title, textWidth, titleFont), {
                x: textX,
                y: height / 2 - 9,
                font: titleFont,
                fill: COLORS.text,
            }),
            text(fit(subtitle, textWidth, siteFont), {
                x: textX,
                y: height / 2 + 10,
                font: siteFont,
                fill: COLORS.muted,
            }),
        ],
    };
};

const renderChip = (content: LinkContent): Rendered => {
    const height = 36;
    const iconSize = 18;
    const titleFont = { family: BLOCK_FONTS.sans, size: 13, weight: 600 };
    const siteFont = { family: BLOCK_FONTS.sans, size: 12 };
    const domain = getDomain(content.url);
    const title = fit(content.title ?? content.siteName ?? domain, 260, titleFont);
    const site = content.title ? domain : "";

    const titleX = 10 + iconSize + 8;
    const siteX = titleX + measure(title, titleFont) + 8;
    const width = Math.ceil((site ? siteX + measure(site, siteFont) : siteX - 8) + 14);

    return {
        width,
        height,
        fonts: { sans: true },
        parts: [
            `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${(height - 1) / 2}" fill="#ffffff" stroke="${COLORS.border}"/>`,
            icon(content, {
                x: 10,
                y: (height - iconSize) / 2,
                size: iconSize,
                radius: 5,
                padding: 0,
            }),
            text(title, { x: titleX, y: height / 2, font: titleFont, fill: COLORS.text }),
            site ? text(site, { x: siteX, y: height / 2, font: siteFont, fill: COLORS.muted }) : "",
        ],
    };
};

const hashSeed = (seed: string) =>
    [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100_000, 7) || 1;

const generator = rough.generator();

const renderSketchy = (content: LinkContent): Rendered => {
    const width = 300;
    const paddingX = 18;
    const paddingTop = 16;
    const textWidth = width - paddingX * 2;
    const titleFont = { family: BLOCK_FONTS.hand, size: 21 };
    const descriptionFont = { family: BLOCK_FONTS.hand, size: 16 };
    const siteFont = { family: BLOCK_FONTS.hand, size: 15 };
    const domain = getDomain(content.url);

    const titleLines = wrap(content.title ?? content.siteName ?? domain, {
        width: textWidth,
        font: titleFont,
        maxLines: 2,
    });
    const descriptionLines = content.description
        ? wrap(content.description, { width: textWidth, font: descriptionFont, maxLines: 3 })
        : [];

    const parts: string[] = [];
    let y = paddingTop;
    for (const line of titleLines) {
        parts.push(text(line, { x: paddingX, y: y + 13, font: titleFont, fill: COLORS.hand }));
        y += 27;
    }
    if (descriptionLines.length > 0) y += 4;
    for (const line of descriptionLines) {
        parts.push(
            text(line, { x: paddingX, y: y + 10, font: descriptionFont, fill: COLORS.handMuted })
        );
        y += 21;
    }
    y += 10;
    // A small arrow out, before the site
    parts.push(
        `<path d="M${paddingX + 1} ${y + 15} L${paddingX + 10} ${y + 6} M${paddingX + 4} ${y + 6} H${paddingX + 10} V${y + 12}" fill="none" stroke="${COLORS.handLink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
        text(fit(domain, textWidth - 18, siteFont), {
            x: paddingX + 18,
            y: y + 10,
            font: siteFont,
            fill: COLORS.handLink,
        })
    );
    const height = Math.ceil(y + 20 + paddingTop - 2);

    const outline = generator
        .toPaths(
            generator.rectangle(1, 1, width - 2, height - 2, {
                seed: hashSeed(content.url),
                roughness: 1,
                strokeWidth: 1.5,
                stroke: COLORS.hand,
            })
        )
        .map(
            path =>
                `<path d="${path.d}" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        )
        .join("");

    return { width, height, fonts: { hand: true }, parts: [outline, ...parts] };
};

const RENDERERS: Record<LinkLook, (content: LinkContent) => Rendered> = {
    compact: renderCompact,
    chip: renderChip,
    sketchy: renderSketchy,
};

/** The card as an SVG, and its size */
export const renderLinkCard = (content: LinkContent, fonts: BlockFontFiles) => {
    const { width, height, parts, fonts: used } = RENDERERS[content.look](content);
    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<defs><style>${getFontFaces(fonts, used)}</style></defs>`,
        ...parts,
        "</svg>",
    ].join("");
    return { svg, width, height };
};
