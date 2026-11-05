/** Excalidraw's hand-drawn font, Excalifont, and its line height */
export const FONT_FAMILY = 5;
export const LINE_HEIGHT = 1.25;

export type TextSize = { width: number; height: number };

/** How text is measured and wrapped: by the browser's fonts in the app, estimated on the API */
export type TextMetrics = {
    measure: (text: string, fontSize: number) => TextSize;
    /** The text with line breaks where it's wider than maxWidth */
    wrap: (text: string, fontSize: number, maxWidth: number) => string;
};

// About Excalifont's width per character, as a part of the font size
const CHAR_WIDTH = 0.55;

const charsPerLine = (fontSize: number, maxWidth: number) =>
    Math.max(1, Math.floor(maxWidth / (fontSize * CHAR_WIDTH)));

const wrapLine = (line: string, max: number) => {
    const lines: string[] = [];
    let current = "";
    for (const word of line.split(" ")) {
        let rest = word;
        // Words longer than a line are broken up
        while (rest.length > max) {
            if (current) lines.push(current);
            lines.push(rest.slice(0, max));
            rest = rest.slice(max);
            current = "";
        }
        const next = current ? `${current} ${rest}` : rest;
        if (next.length > max) {
            lines.push(current);
            current = rest;
        } else {
            current = next;
        }
    }
    lines.push(current);
    return lines.join("\n");
};

/** Without fonts to measure with: Excalifont's average character width */
export const EstimatedTextMetrics: TextMetrics = {
    measure: (text, fontSize) => {
        const lines = text.split("\n");
        const longest = Math.max(...lines.map(line => line.length), 0);
        return {
            width: Math.ceil(longest * fontSize * CHAR_WIDTH),
            height: lines.length * fontSize * LINE_HEIGHT,
        };
    },
    wrap: (text, fontSize, maxWidth) => {
        const max = charsPerLine(fontSize, maxWidth);
        return text
            .split("\n")
            .map(line => wrapLine(line, max))
            .join("\n");
    },
};
