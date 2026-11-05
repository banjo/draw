import {
    DiagramBuilder,
    DiagramEditor,
    DiagramReader,
    DiagramSpec,
    DiagramSpecUtil,
    Env,
    ExcalidrawElement,
    ExcalidrawSimpleElement,
    LinkContent,
    MAX_ELEMENTS,
    McpCreateDiagramInput,
    McpUpdateDiagramInput,
} from "common";
import { createContextLogger } from "../lib/context-logger";
import { drawingEmitter } from "../model/emitters";
import { DrawRepository } from "../repositories/draw-repository";
import { LinkPreviewService } from "./link-preview-service";

const logger = createContextLogger("mcp-diagram-service");

/** A message the MCP client gets, about something it can fix */
export class McpToolError extends Error {}

// Icons bigger than this are left out of link cards, as they're kept in the drawing
const MAX_ICON_LENGTH = 16 * 1024;

const getAppUrl = (slug: string) => `${Env.server().CLIENT_URL}/draw/${slug}`;

/** A link card's title, description and icon, from the page */
const getLinkContent = async (url: string): Promise<LinkContent> => {
    if (!/^https?:\/\//i.test(url)) return { url, look: "compact" };
    const preview = await LinkPreviewService.getPreview(url).catch(() => ({ url }));
    const { icon, ...rest } = preview as LinkContent;
    return {
        ...rest,
        ...(icon && icon.length <= MAX_ICON_LENGTH ? { icon } : {}),
        look: "compact",
    };
};

/** The drawing, if the user owns it. Others' drawings are "not found" too, so they can't be probed. */
const requireOwner = async (slug: string, userId: number) => {
    const access = await DrawRepository.getAccessSettings(slug);
    if (!access.success) throw new Error(access.message);
    if (access.data?.ownerId !== userId) throw new McpToolError("Drawing not found");
};

const getLiveElements = async (slug: string) => {
    const board = await drawingEmitter.getLatestBoard(slug);
    if (!board) throw new McpToolError("Drawing not found");
    return board.elements.filter(element => !element.isDeleted) as unknown as ExcalidrawElement[];
};

const OTHER_KINDS: Record<string, string> = {
    freedraw: "drawing",
    line: "line",
    arrow: "loose arrow",
    image: "image",
    mermaid: "Mermaid diagram",
    swimlane: "swimlane",
    embeddable: "embed",
};

/** What a diagram can't hold, like drawings and images, in a few words */
const describeOthers = (elements: ExcalidrawElement[], used: Set<string>) => {
    const counts = new Map<string, number>();
    elements.forEach(element => {
        if (used.has(element.id)) return;
        const type = element.customData?.type;
        if (type === "swimlane-part") return;
        if (element.type === "text" && "containerId" in element && element.containerId) return;
        if (element.type === "frame" && type !== "swimlane") return;
        const kind = (type && OTHER_KINDS[type]) ?? OTHER_KINDS[element.type] ?? "other element";
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
    });
    const parts = [...counts].map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`);
    return {
        count: [...counts.values()].reduce((sum, count) => sum + count, 0),
        summary: parts.join(", ") || "nothing",
    };
};

const list = async (userId: number) => {
    const drawings = await DrawRepository.getOwnedDrawings(userId);
    if (!drawings.success) throw new Error(drawings.message);
    return {
        diagrams: drawings.data.map(drawing => ({
            slug: drawing.slug,
            name: drawing.name ?? "Untitled",
            appUrl: getAppUrl(drawing.slug),
            updatedAt: drawing.updatedAt.toISOString(),
        })),
    };
};

const get = async (userId: number, slug: string) => {
    await requireOwner(slug, userId);
    const [elements, name] = await Promise.all([
        getLiveElements(slug),
        DrawRepository.getDrawingName(slug),
    ]);
    const read = DiagramReader.read(elements, elements, { ids: "element" });
    const spec = read.spec ?? { direction: "right", groups: [], nodes: [], edges: [] };
    const frames = [...read.frameOf.values()];
    const named = new Map(
        elements
            .filter(element => frames.includes(element.id))
            .map(frame => [frame.id, (frame as { name?: string | null }).name ?? "Group"])
    );

    const round = (value: number) => Math.round(value);
    return {
        slug,
        name: (name.success && name.data) || "Untitled",
        appUrl: getAppUrl(slug),
        diagram: {
            direction: spec.direction,
            // Every group, also the empty ones, as their ids can be used
            groups: frames.map(id => ({ id, label: named.get(id) ?? "Group" })),
            nodes: spec.nodes.map(node => {
                const box = read.boxes.get(node.id)!;
                return {
                    ...node,
                    box: {
                        x: round(box.x),
                        y: round(box.y),
                        width: round(box.width),
                        height: round(box.height),
                    },
                };
            }),
            edges: spec.edges.map((edge, i) => ({ id: read.arrowOf[i]!, ...edge })),
        },
        other: describeOthers(elements, new Set(read.replaces)),
    };
};

/** What cleaning a diagram dropped, so the client knows */
const getWarnings = (before: DiagramSpec, after: DiagramSpec) => {
    const warnings: string[] = [];
    const dropped = (count: number, what: string) =>
        count > 0 && warnings.push(`${count} ${what} left out`);
    dropped(
        before.nodes.length - after.nodes.length,
        "nodes with an id that was used already were"
    );
    dropped(before.edges.length - after.edges.length, "edges to nodes that aren't there were");
    dropped(before.groups.length - after.groups.length, "groups without nodes were");
    const ungrouped = after.nodes.filter(
        (node, i) =>
            before.nodes.find(other => other.id === node.id)?.group && !node.group && i >= 0
    ).length;
    dropped(ungrouped, "groups of nodes, in groups that aren't there, were");
    return warnings;
};

const create = async (userId: number, input: McpCreateDiagramInput) => {
    const spec = DiagramSpecUtil.clean(input.diagram);
    const built = await DiagramBuilder.build(spec, { getLinkContent });
    const created = await DrawRepository.createCopy({
        elements: built.elements as unknown as ExcalidrawSimpleElement[],
        name: input.name,
        ownerId: userId,
    });
    if (!created.success) throw new Error(created.message);
    logger.info(
        { slug: created.data, elements: built.elements.length },
        "Diagram created over MCP"
    );

    return {
        slug: created.data,
        name: input.name,
        appUrl: getAppUrl(created.data),
        ids: Object.fromEntries([...built.elementOf, ...built.frameOf]),
        warnings: getWarnings(input.diagram, spec),
    };
};

const update = async (userId: number, input: McpUpdateDiagramInput) => {
    const { slug, name, ...changes } = input;
    const hasChanges =
        Boolean(
            changes.add?.nodes.length || changes.add?.edges.length || changes.add?.groups.length
        ) || Boolean(changes.update?.length || changes.remove?.length);
    if (!hasChanges && !name) throw new McpToolError("Nothing to change");

    await requireOwner(slug, userId);
    const board = await drawingEmitter.getLatestBoard(slug);
    if (!board) throw new McpToolError("Drawing not found");

    let ids: Record<string, string> = {};
    let edges: string[] = [];
    if (hasChanges) {
        const scene = board.elements as unknown as ExcalidrawElement[];
        const result = await DiagramEditor.apply(scene, changes, { getLinkContent });
        if (!result.success) throw new McpToolError(result.message);

        const live = new Set(
            scene.filter(element => !element.isDeleted).map(element => element.id)
        );
        result.elements.forEach(element =>
            element.isDeleted ? live.delete(element.id) : live.add(element.id)
        );
        if (live.size > MAX_ELEMENTS) throw new McpToolError("Too many elements");

        const updated = await drawingEmitter.update(slug, {
            excalidrawElements: result.elements as unknown as ExcalidrawSimpleElement[],
        });
        if (!updated.success) throw new McpToolError("Drawing not found");
        ({ ids, edges } = result);
        logger.info({ slug, elements: result.elements.length }, "Diagram changed over MCP");
    }

    if (name) {
        const renamed = await DrawRepository.updateDrawingName(slug, name, userId);
        if (!renamed.success) throw new Error(renamed.message);
    }

    return { slug, appUrl: getAppUrl(slug), ids, edges };
};

export const McpDiagramService = { list, get, create, update };
