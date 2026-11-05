import { z } from "zod";
import {
    DIAGRAM_CHART_TYPES,
    DIAGRAM_COLORS,
    DIAGRAM_SHAPES,
    DiagramEdge,
    DiagramGroup,
    DiagramNode,
    DiagramSpec,
} from "./ai";

export const McpTokenCreateInput = z.object({ name: z.string().trim().min(1).max(60) });
export type McpTokenCreateInput = z.infer<typeof McpTokenCreateInput>;

export const McpTokenRevokeInput = z.object({ id: z.string().uuid() });
export type McpTokenRevokeInput = z.infer<typeof McpTokenRevokeInput>;

const Id = z.string().min(1).max(80);
const Text = z.string().max(500);
const DrawingName = z.string().trim().min(1).max(200);
const DrawingSlug = z.string().uuid().describe("The drawing's slug, from list_diagrams");

export const McpGetDiagramInput = z.object({ slug: DrawingSlug });

export const McpCreateDiagramInput = z.object({
    name: DrawingName,
    diagram: DiagramSpec,
});
export type McpCreateDiagramInput = z.infer<typeof McpCreateDiagramInput>;

/** A change to a node, an edge or a group. Only the fields that suit what it is are allowed. */
export const DiagramChange = z
    .object({
        id: Id.describe("The id of a node, an edge or a group, from get_diagram"),
        label: Text.optional().describe(
            "A shape's, sticky note's, text's or edge's text, or a group's name. Empty removes a shape's or edge's label."
        ),
        color: z
            .enum(DIAGRAM_COLORS)
            .nullable()
            .optional()
            .describe("A shape's or sticky note's color, null for none"),
        shape: z.enum(DIAGRAM_SHAPES).optional(),
        size: z.enum(["small", "medium", "large"]).optional().describe("A text's size"),
        markdown: z.string().max(4000).optional().describe("A note's Markdown"),
        width: z.enum(["S", "M", "L"]).optional().describe("A note's width"),
        rows: z
            .array(z.array(z.string().max(200)).max(12))
            .min(1)
            .max(50)
            .optional()
            .describe("A table's or chart's rows"),
        headerRow: z.boolean().optional(),
        headerColumn: z.boolean().optional(),
        chartType: z.enum(DIAGRAM_CHART_TYPES).optional(),
        title: z.string().max(200).optional().describe("A chart's title"),
        language: z.string().max(40).optional().describe("A code block's language"),
        code: z.string().max(4000).optional(),
        url: z.string().max(2048).optional().describe("A link card's address"),
        style: z.enum(["solid", "dashed", "dotted"]).optional().describe("An edge's line"),
        heads: z.enum(["end", "both", "none"]).optional().describe("An edge's arrowheads"),
    })
    .strict();
export type DiagramChange = z.infer<typeof DiagramChange>;

export const DiagramAdditions = z.object({
    groups: z.array(DiagramGroup).max(20).default([]),
    nodes: z.array(DiagramNode).max(80).default([]),
    edges: z.array(DiagramEdge).max(160).default([]),
});
export type DiagramAdditions = z.infer<typeof DiagramAdditions>;

export const DiagramChanges = z.object({
    add: DiagramAdditions.optional().describe(
        "New groups, nodes and edges. New ids are yours to pick; edges and groups can refer to new and existing ids."
    ),
    update: z.array(DiagramChange).max(200).optional(),
    remove: z
        .array(Id)
        .max(500)
        .optional()
        .describe(
            "Ids of nodes, edges or groups. A node takes its edges with it; a group's nodes stay."
        ),
});
export type DiagramChanges = z.infer<typeof DiagramChanges>;

export const McpUpdateDiagramInput = DiagramChanges.extend({
    slug: DrawingSlug,
    name: DrawingName.optional().describe("A new name for the drawing"),
});
export type McpUpdateDiagramInput = z.infer<typeof McpUpdateDiagramInput>;
