import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { BinaryFiles, DataURL } from "@excalidraw/excalidraw/types";
import { ExcalidrawElements } from "common";

export type MermaidImage = { dataURL: DataURL; width: number; height: number };
export type MermaidShapes = { elements: ExcalidrawElements; files: BinaryFiles };

// The look of a Mermaid block. Set on each diagram, as Excalidraw's converter changes
// Mermaid's shared settings. Arial has the same widths everywhere, so text fits its boxes
// in every browser. No quotes: Mermaid reads the settings with ' as ".
const FONT_FAMILY = "Arial, Helvetica, sans-serif";
const BLOCK_CONFIG = {
    // Excalidraw's dark lines and pale fills, as on the canvas
    theme: "base",
    themeVariables: {
        fontFamily: FONT_FAMILY,
        fontSize: "16px",
        primaryColor: "#e7f5ff",
        primaryBorderColor: "#1e1e1e",
        primaryTextColor: "#1e1e1e",
        secondaryColor: "#fff9db",
        tertiaryColor: "#ebfbee",
        lineColor: "#1e1e1e",
        textColor: "#1e1e1e",
        edgeLabelBackground: "#ffffff",
    },
    look: "handDrawn",
    handDrawnSeed: 1,
    // Labels as SVG text: HTML in an image is left out when it's drawn on a canvas
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: "basis" },
    fontFamily: FONT_FAMILY,
    fontSize: 16,
};

// Mermaid is one shared instance, so it draws one diagram at a time
let queue: Promise<unknown> = Promise.resolve();
const inTurn = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
};

let renderCount = 0;

/** The diagram with the block's settings, unless it has its own (front matter) */
const withBlockConfig = (definition: string) =>
    definition.trimStart().startsWith("---")
        ? definition
        : `%%{init: ${JSON.stringify(BLOCK_CONFIG)}}%%\n${definition}`;

const toBase64 = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(byte => (binary += String.fromCharCode(byte)));
    return btoa(binary);
};

/** Mermaid's SVG fills its container; an image needs its own size */
const toImage = (svg: string): MermaidImage => {
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = document.documentElement;
    const [, , width = 0, height = 0] = (root.getAttribute("viewBox") ?? "")
        .split(/[\s,]+/)
        .map(Number);
    if (!width || !height) throw new Error("The diagram is empty");

    root.setAttribute("width", String(width));
    root.setAttribute("height", String(height));
    root.removeAttribute("style");
    const text = new XMLSerializer().serializeToString(root);

    return {
        dataURL: `data:image/svg+xml;base64,${toBase64(text)}` as DataURL,
        width,
        height,
    };
};

/** The diagram as one hand-drawn image, for a Mermaid block */
const renderImage = (definition: string) =>
    inTurn(async () => {
        const { default: mermaid } = await import("mermaid");
        // Throws on a mistake, where render would leave an error picture in the page. Without
        // the settings, so the line numbers are the diagram's.
        await mermaid.parse(definition);
        const text = withBlockConfig(definition);
        const { svg } = await mermaid.render(`banjodraw-mermaid-${renderCount++}`, text);
        return toImage(svg);
    });

/**
 * The diagram as Excalidraw shapes, with Excalidraw's own converter. Flowcharts, sequence,
 * class, ER and state diagrams become shapes; other kinds an image.
 */
const renderShapes = (definition: string) =>
    inTurn(async (): Promise<MermaidShapes> => {
        const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
        // As in Excalidraw: double quotes trip the converter in some diagrams
        const result = await parseMermaidToExcalidraw(definition).catch(() =>
            parseMermaidToExcalidraw(definition.replace(/"/g, "'"))
        );

        return {
            elements: convertToExcalidrawElements(result.elements, {
                regenerateIds: true,
            }) as unknown as ExcalidrawElements,
            files: result.files ?? {},
        };
    });

// The kinds Excalidraw's converter turns into shapes; it makes the rest one plain image
const SHAPE_KINDS = new Set([
    "flowchart",
    "graph",
    "sequenceDiagram",
    "classDiagram",
    "erDiagram",
    "stateDiagram",
    "stateDiagram-v2",
]);

/** Whether the diagram can become shapes: its first word, after any settings and comments */
const canBeShapes = (definition: string) => {
    const kind = definition
        .replace(/^\s*---[\s\S]*?---/, "")
        .split("\n")
        .map(line => line.trim())
        .find(line => line && !line.startsWith("%%"))
        ?.split(/\s/)[0];
    return kind !== undefined && SHAPE_KINDS.has(kind);
};

export const MermaidRenderer = { renderImage, renderShapes, canBeShapes };
