import { z } from "zod";

/** AI requests a free account gets a day. Pro has no limit. */
export const AI_FREE_DAILY_LIMIT = 10;
export const AI_PROMPT_MAX_LENGTH = 2000;
export const MERMAID_MAX_LENGTH = 20_000;

export const AiPlan = z.enum(["free", "pro"]);
export type AiPlan = z.infer<typeof AiPlan>;

export type AiStatus = {
    plan: AiPlan;
    /** Requests made today, in UTC */
    used: number;
    /** Requests a day, or null for no limit */
    limit: number | null;
    /** When the day's requests start over, as an ISO date */
    resetsAt: string;
    /** Whether the API has an AI to ask */
    isEnabled: boolean;
};

export const DIAGRAM_SHAPES = [
    "rectangle",
    "rounded",
    "ellipse",
    "circle",
    "diamond",
    "pill",
    "hexagon",
    "parallelogram",
    "cylinder",
    "document",
    "cloud",
    "triangle",
    "star",
] as const;

export const DIAGRAM_COLORS = [
    "gray",
    "red",
    "pink",
    "violet",
    "blue",
    "cyan",
    "teal",
    "green",
    "yellow",
    "orange",
] as const;

export type DiagramShape = (typeof DIAGRAM_SHAPES)[number];
export type DiagramColor = (typeof DIAGRAM_COLORS)[number];

export const DIAGRAM_CHART_TYPES = ["bar", "stacked", "hbar", "line", "pie", "donut"] as const;

const Id = z.string().min(1).max(80);
const Text = z.string().max(500);
const Rows = z
    .array(z.array(z.string().max(200)).max(12))
    .min(1)
    .max(50);
const Color = z.enum(DIAGRAM_COLORS);

const inGroup = {
    id: Id,
    group: Id.optional().describe("The id of the group it's in, if any"),
};

const ShapeNode = z.object({
    ...inGroup,
    type: z.literal("shape"),
    shape: z.enum(DIAGRAM_SHAPES).describe("cylinder for databases, document for files"),
    label: Text.optional(),
    color: Color.optional(),
});

const TextNode = z.object({
    ...inGroup,
    type: z.literal("text"),
    text: Text,
    size: z.enum(["small", "medium", "large"]).optional(),
});

const StickyNode = z.object({
    ...inGroup,
    type: z.literal("sticky"),
    text: Text.describe("A few words, a short sentence at most"),
    color: Color.optional().describe("Yellow when left out"),
});

const NoteNode = z.object({
    ...inGroup,
    type: z.literal("note"),
    markdown: z
        .string()
        .max(4000)
        .describe("Markdown: headings, lists, - [ ] checkboxes, bold, links, `code`"),
    width: z.enum(["S", "M", "L"]).optional(),
});

const TableNode = z.object({
    ...inGroup,
    type: z.literal("table"),
    rows: Rows.describe("Every row has the same number of cells"),
    headerRow: z.boolean().optional(),
    headerColumn: z.boolean().optional(),
});

const ChartNode = z.object({
    ...inGroup,
    type: z.literal("chart"),
    chartType: z
        .enum(DIAGRAM_CHART_TYPES)
        .describe("stacked is stacked bars, hbar horizontal bars"),
    title: z.string().max(200).optional(),
    rows: Rows.describe(
        "The first row has the series' names after an empty cell, then a row per label: the label, then a number per series"
    ),
});

const CodeNode = z.object({
    ...inGroup,
    type: z.literal("code"),
    language: z.string().max(40),
    code: z.string().max(4000),
});

const LinkNode = z.object({
    ...inGroup,
    type: z.literal("link"),
    url: z.string().max(2048).describe("A full web address, https://…"),
});

export const DiagramNode = z.discriminatedUnion("type", [
    ShapeNode,
    TextNode,
    StickyNode,
    NoteNode,
    TableNode,
    ChartNode,
    CodeNode,
    LinkNode,
]);
export type DiagramNode = z.infer<typeof DiagramNode>;

export const DiagramEdge = z.object({
    from: Id,
    to: Id,
    label: Text.optional(),
    style: z.enum(["solid", "dashed", "dotted"]).optional(),
    heads: z.enum(["end", "both", "none"]).optional().describe("end when left out"),
});
export type DiagramEdge = z.infer<typeof DiagramEdge>;

export const DiagramGroup = z.object({ id: Id, label: Text });
export type DiagramGroup = z.infer<typeof DiagramGroup>;

/** A diagram made of BanjoDraw's shapes and blocks, which the app lays out */
export const DiagramSpec = z.object({
    direction: z.enum(["right", "down"]).describe("Which way the arrows mostly go"),
    groups: z.array(DiagramGroup).max(20).describe("Frames around nodes that belong together"),
    nodes: z.array(DiagramNode).min(1).max(80),
    edges: z.array(DiagramEdge).max(160),
});
export type DiagramSpec = z.infer<typeof DiagramSpec>;

/** Without arrows and groups that point at nodes or groups that aren't there */
const clean = (diagram: DiagramSpec): DiagramSpec => {
    const nodes = diagram.nodes.filter(
        (node, i) => diagram.nodes.findIndex(other => other.id === node.id) === i
    );
    const nodeIds = new Set(nodes.map(node => node.id));
    const groups = diagram.groups.filter(group => !nodeIds.has(group.id));
    const groupIds = new Set(groups.map(group => group.id));

    return {
        direction: diagram.direction,
        groups: groups.filter(group => nodes.some(node => node.group === group.id)),
        nodes: nodes.map(node =>
            node.group && !groupIds.has(node.group) ? { ...node, group: undefined } : node
        ),
        edges: diagram.edges.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
    };
};

export const DiagramSpecUtil = { clean };

export const AiDiagramInput = z.object({
    prompt: z.string().trim().min(1).max(AI_PROMPT_MAX_LENGTH),
    /** What's selected, or the result so far, to change */
    current: DiagramSpec.optional(),
    /** A selected Mermaid diagram, to turn into shapes */
    mermaid: z.string().max(MERMAID_MAX_LENGTH).optional(),
});
export type AiDiagramInput = z.infer<typeof AiDiagramInput>;

export const AiMermaidInput = z.object({
    prompt: z.string().trim().min(1).max(AI_PROMPT_MAX_LENGTH),
    /** The Mermaid diagram so far, to change */
    current: z.string().max(MERMAID_MAX_LENGTH).optional(),
    /** Selected shapes, to turn into Mermaid */
    diagram: DiagramSpec.optional(),
    /** A diagram Mermaid couldn't read, and why, to fix */
    fix: z
        .object({
            definition: z.string().max(MERMAID_MAX_LENGTH),
            error: z.string().max(2000),
        })
        .optional(),
});
export type AiMermaidInput = z.infer<typeof AiMermaidInput>;

export type AiDiagramResult = { summary: string; diagram: DiagramSpec };
export type AiMermaidResult = { summary: string; definition: string };
