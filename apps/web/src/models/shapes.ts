import { CustomElementType } from "common";

/** "shape" is a plain Excalidraw shape, "block" one of BanjoDraw's own elements */
export type ShapeKind = "shape" | "block";

/** The palettes show shapes in these groups, in this order */
export const SHAPE_GROUPS = ["Basic", "Flowchart", "Other", "Blocks"] as const;
export type ShapeGroup = (typeof SHAPE_GROUPS)[number];

export type Shape = {
    type: CustomElementType;
    kind: ShapeKind;
    group: ShapeGroup;
    title?: string;
    description?: string;
    /** Other words it's found by, e.g. "database" for a model */
    tags: string[];
    /** Added from the palette, but not offered when changing a shape with Tab */
    addOnly?: boolean;
};

export const shapes: Shape[] = [
    {
        type: "rectangle",
        kind: "shape",
        group: "Basic",
        title: "Rectangle",
        description: "A simple rectangle shape",
        tags: ["box", "square", "container", "node", "process"],
    },
    {
        type: "ellipse",
        kind: "shape",
        group: "Basic",
        title: "Ellipse",
        description: "A simple ellipse shape",
        tags: ["oval", "round"],
    },
    {
        type: "circle",
        kind: "shape",
        group: "Basic",
        title: "Circle",
        description: "An ellipse as wide as it's tall",
        tags: ["round", "dot", "node"],
    },
    {
        type: "diamond",
        kind: "shape",
        group: "Basic",
        title: "Diamond",
        description: "A simple diamond shape",
        tags: ["decision", "condition", "rhombus"],
    },
    {
        type: "triangle",
        kind: "shape",
        group: "Basic",
        title: "Triangle",
        description: "Points up",
        tags: ["warning", "pyramid"],
    },
    {
        type: "hexagon",
        kind: "shape",
        group: "Basic",
        title: "Hexagon",
        description: "Six sides",
        tags: ["preparation", "service", "polygon"],
    },
    {
        type: "star",
        kind: "shape",
        group: "Basic",
        title: "Star",
        description: "Five points",
        tags: ["favorite", "highlight", "important"],
    },
    {
        type: "pill",
        kind: "shape",
        group: "Flowchart",
        title: "Pill",
        description: "Rounded ends, for start and end",
        tags: ["terminal", "start", "end", "rounded", "stadium", "capsule"],
    },
    {
        type: "parallelogram",
        kind: "shape",
        group: "Flowchart",
        title: "Parallelogram",
        description: "Input and output",
        tags: ["input", "output", "data", "slanted"],
    },
    {
        type: "cylinder",
        kind: "shape",
        group: "Flowchart",
        title: "Cylinder",
        description: "A database or storage",
        tags: ["database", "storage", "db", "disk"],
    },
    {
        type: "document",
        kind: "shape",
        group: "Flowchart",
        title: "Document",
        description: "A page with a wavy edge",
        tags: ["file", "page", "report", "paper"],
    },
    {
        type: "cloud",
        kind: "shape",
        group: "Other",
        title: "Cloud",
        description: "The internet or an outside service",
        tags: ["internet", "network", "external", "sky"],
    },
    {
        type: "sticky-note",
        kind: "shape",
        group: "Other",
        title: "Sticky note",
        description: "A yellow note to write on",
        tags: ["note", "post-it", "comment", "memo", "yellow"],
    },
    {
        type: "codeblock",
        kind: "block",
        group: "Blocks",
        title: "Code Block",
        description: "A code block with syntax highlighting",
        tags: ["code", "snippet", "syntax", "programming", "source"],
    },
    {
        type: "model",
        kind: "block",
        group: "Blocks",
        title: "Model",
        description: "A table for modelling simple entities",
        tags: ["entity", "database", "schema", "class", "data", "erd"],
    },
    {
        type: "mermaid",
        kind: "block",
        group: "Blocks",
        title: "Mermaid",
        description: "A diagram written in Mermaid",
        tags: ["diagram", "flowchart", "sequence", "chart", "text", "graph", "uml"],
        addOnly: true,
    },
    {
        type: "table",
        kind: "block",
        group: "Blocks",
        title: "Table",
        description: "Rows and columns to type in",
        tags: ["grid", "rows", "columns", "spreadsheet", "matrix", "compare", "data"],
    },
    {
        type: "markdown",
        kind: "block",
        group: "Blocks",
        title: "Markdown note",
        description: "A note with headings, lists, checkboxes and links",
        tags: ["note", "text", "markdown", "checklist", "todo", "rich text", "list"],
    },
    {
        type: "swimlane",
        kind: "block",
        group: "Blocks",
        title: "Swimlane",
        description: "Lanes that hold shapes, for a process across people or systems",
        tags: ["lanes", "pool", "process", "bpmn", "frame", "container", "flow"],
        addOnly: true,
    },
];

const SHAPE_TYPES = new Set(shapes.filter(s => s.kind === "shape").map(s => s.type));

/** A shape that only changes its type when changed to another, keeping its id */
export const isShapeType = (type: unknown): type is CustomElementType =>
    SHAPE_TYPES.has(type as CustomElementType);
