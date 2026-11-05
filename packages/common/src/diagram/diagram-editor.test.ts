import { describe, expect, it } from "vitest";
import { DiagramSpec } from "../model/ai";
import { ExcalidrawElement } from "../model/excalidraw-element";
import { DiagramChanges } from "../model/mcp";
import { DiagramBuilder } from "./diagram-builder";
import { DiagramEditor } from "./diagram-editor";
import { DiagramReader } from "./diagram-reader";
import { ElementFactory } from "./element-factory";

const spec: DiagramSpec = {
    direction: "right",
    groups: [{ id: "backend", label: "Backend" }],
    nodes: [
        { id: "web", type: "shape", shape: "rounded", label: "Web" },
        { id: "api", type: "shape", shape: "rectangle", label: "API", group: "backend" },
        { id: "db", type: "shape", shape: "cylinder", label: "DB", group: "backend" },
        { id: "owners", type: "table", rows: [["Part", "Owner"]] },
    ],
    edges: [
        { from: "web", to: "api", label: "HTTPS" },
        { from: "api", to: "db" },
    ],
};

type Arrow = ExcalidrawElement & {
    startBinding: { elementId: string } | null;
    endBinding: { elementId: string } | null;
    startArrowhead: string | null;
    endArrowhead: string | null;
};

const setup = async () => {
    const built = await DiagramBuilder.build(spec);
    const id = (node: string) => built.elementOf.get(node)!;
    const arrowBetween = (from: string, to: string) =>
        built.elements.find(
            element =>
                element.type === "arrow" &&
                (element as Arrow).startBinding?.elementId === id(from) &&
                (element as Arrow).endBinding?.elementId === id(to)
        )!.id;
    return { scene: built.elements, id, frame: built.frameOf.get("backend")!, arrowBetween };
};

/** The scene with the changed elements in it */
const merge = (scene: ExcalidrawElement[], changed: ExcalidrawElement[]) => {
    const byId = new Map(scene.map(element => [element.id, element]));
    changed.forEach(element => byId.set(element.id, element));
    return [...byId.values()];
};

const edit = async (scene: ExcalidrawElement[], changes: DiagramChanges) => {
    const result = await DiagramEditor.apply(scene, changes);
    if (!result.success) throw new Error(result.message);
    return { ...result, scene: merge(scene, result.elements) };
};

const live = (scene: ExcalidrawElement[]) => scene.filter(element => !element.isDeleted);

const intersects = (a: ExcalidrawElement, b: ExcalidrawElement) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Nodes outside the frame that it covers */
const coveredBy = (scene: ExcalidrawElement[], frame: ExcalidrawElement) =>
    live(scene).filter(
        element =>
            element.id !== frame.id &&
            element.frameId !== frame.id &&
            ["rectangle", "ellipse", "diamond", "image"].includes(element.type) &&
            intersects(element, frame)
    );

describe("DiagramEditor", () => {
    it("changes only what it's asked to, with new versions", async () => {
        const { scene, id } = await setup();
        const result = await edit(scene, {
            update: [{ id: id("web"), label: "Web app", color: "green" }],
        });

        const web = result.scene.find(element => element.id === id("web"))!;
        const before = scene.find(element => element.id === id("web"))!;
        expect(web.backgroundColor).toBe("#b2f2bb");
        expect(web.version).toBe(before.version + 1);
        expect({ x: web.x, y: web.y }).toEqual({ x: before.x, y: before.y });

        const label = result.scene.find(
            element => element.id === web.boundElements!.find(bound => bound.type === "text")!.id
        ) as ExcalidrawElement & { originalText: string };
        expect(label.originalText).toBe("Web app");
        expect(label.customData?.unmeasured).toBe(true);

        const changedIds = result.elements.map(element => element.id).sort();
        expect(changedIds).toEqual([id("web"), label.id].sort());
    });

    it("moves the arrows of a shape that grew, so they don't end inside it", async () => {
        const { scene, id, arrowBetween } = await setup();
        const arrowId = arrowBetween("web", "api");
        const result = await edit(scene, {
            update: [{ id: id("web"), label: "A much longer label for the web app" }],
        });

        const web = result.scene.find(element => element.id === id("web"))!;
        const arrow = result.scene.find(element => element.id === arrowId)!;
        expect(web.width).toBeGreaterThan(scene.find(element => element.id === id("web"))!.width);
        expect(arrow.version).toBeGreaterThan(
            scene.find(element => element.id === arrowId)!.version
        );
        expect(arrow.x).toBeGreaterThanOrEqual(web.x + web.width);
    });

    it("removes a node with its label and its arrows, and unbinds the other ends", async () => {
        const { scene, id, arrowBetween } = await setup();
        const arrow = arrowBetween("web", "api");
        const result = await edit(scene, { remove: [id("web")] });

        const removed = result.elements
            .filter(element => element.isDeleted)
            .map(element => element.id);
        expect(removed).toContain(id("web"));
        expect(removed).toContain(arrow);
        const api = result.scene.find(element => element.id === id("api"))!;
        expect(api.boundElements?.some(bound => bound.id === arrow)).toBe(false);

        const read = DiagramReader.read(live(result.scene), live(result.scene), { ids: "element" });
        expect(read.spec?.nodes.map(node => node.id)).not.toContain(id("web"));
        expect(read.spec?.edges).toHaveLength(1);
    });

    it("changes nothing when an id is unknown", async () => {
        const { scene, id } = await setup();
        const result = await DiagramEditor.apply(scene, {
            update: [{ id: id("web"), label: "Changed" }],
            remove: ["missing"],
        });
        expect(result).toEqual({ success: false, message: "Unknown id: missing" });
    });

    it("refuses changes that don't suit what an id is", async () => {
        const { scene, id } = await setup();
        const result = await DiagramEditor.apply(scene, {
            update: [{ id: id("owners"), label: "Hi" }],
        });
        expect(result.success).toBe(false);
    });

    it("adds a node next to the one it's connected to, bound both ways", async () => {
        const { scene, id } = await setup();
        const result = await edit(scene, {
            add: {
                groups: [],
                nodes: [{ id: "cache", type: "shape", shape: "cylinder", label: "Redis" }],
                edges: [{ from: id("web"), to: "cache", label: "GET" }],
            },
        });

        const cache = result.scene.find(element => element.id === result.ids.cache)!;
        const web = result.scene.find(element => element.id === id("web"))!;
        expect(cache.x).toBeGreaterThan(web.x + web.width);

        const [arrowId] = result.edges;
        const arrow = result.scene.find(element => element.id === arrowId) as Arrow;
        expect(arrow.startBinding?.elementId).toBe(id("web"));
        expect(arrow.endBinding?.elementId).toBe(result.ids.cache);
        expect(web.boundElements).toContainEqual({ id: arrowId, type: "arrow" });
        expect(cache.boundElements).toContainEqual({ id: arrowId, type: "arrow" });

        const others = live(scene).filter(element => element.id !== id("web"));
        others.forEach(element => {
            const after = result.scene.find(other => other.id === element.id)!;
            expect({ x: after.x, y: after.y }).toEqual({ x: element.x, y: element.y });
        });
    });

    it("puts a new node in a group that's there, and grows its frame", async () => {
        const { scene, frame } = await setup();
        const before = scene.find(element => element.id === frame)!;
        const result = await edit(scene, {
            add: {
                groups: [],
                nodes: [
                    { id: "queue", type: "shape", shape: "pill", label: "Queue", group: frame },
                ],
                edges: [],
            },
        });
        const queue = result.scene.find(element => element.id === result.ids.queue)!;
        const after = result.scene.find(element => element.id === frame)!;
        expect(queue.frameId).toBe(frame);
        expect(after.x + after.width).toBeGreaterThanOrEqual(queue.x + queue.width);
        expect(after.y + after.height).toBeGreaterThanOrEqual(queue.y + queue.height);
        expect(after.width * after.height).toBeGreaterThan(before.width * before.height);
        expect(coveredBy(result.scene, after)).toEqual([]);
    });

    it("grows a group only where it doesn't cover what's outside it", async () => {
        const { scene, frame, id } = await setup();
        const box = scene.find(element => element.id === frame)!;
        // Right below and right of the group, as close as can be
        const below = ElementFactory.shape({
            type: "rectangle",
            customData: { type: "rectangle", shadow: false },
            x: box.x,
            y: box.y + box.height + 10,
            width: 150,
            height: 80,
        });
        const right = ElementFactory.shape({
            type: "rectangle",
            customData: { type: "rectangle", shadow: false },
            x: box.x + box.width + 10,
            y: box.y,
            width: 150,
            height: 80,
        });
        let current = [...scene, below, right];
        // Several new nodes connected to one in the group, which fill the space around it
        for (const n of [1, 2, 3, 4]) {
            const result = await edit(current, {
                add: {
                    groups: [],
                    nodes: [
                        {
                            id: `n${n}`,
                            type: "shape",
                            shape: "rectangle",
                            label: `Node ${n}`,
                            group: frame,
                        },
                    ],
                    edges: [{ from: id("api"), to: `n${n}` }],
                },
            });
            current = result.scene;
            const grown = current.find(element => element.id === frame)!;
            expect(coveredBy(current, grown)).toEqual([]);
        }
    });

    it("keeps new nodes outside groups out of their frames", async () => {
        const { scene, frame, id } = await setup();
        const result = await edit(scene, {
            add: {
                groups: [],
                nodes: [{ id: "x", type: "shape", shape: "rectangle", label: "Outside" }],
                edges: [{ from: id("api"), to: "x" }],
            },
        });
        const x = result.scene.find(element => element.id === result.ids.x)!;
        expect(
            intersects(
                x,
                result.scene.find(element => element.id === frame)!
            )
        ).toBe(false);
    });

    it("makes a frame for a new group", async () => {
        const { scene } = await setup();
        const result = await edit(scene, {
            add: {
                groups: [{ id: "ops", label: "Ops" }],
                nodes: [
                    { id: "logs", type: "shape", shape: "rectangle", label: "Logs", group: "ops" },
                    {
                        id: "alerts",
                        type: "shape",
                        shape: "rectangle",
                        label: "Alerts",
                        group: "ops",
                    },
                ],
                edges: [{ from: "logs", to: "alerts" }],
            },
        });
        const frame = result.scene.find(element => element.id === result.ids.ops)!;
        expect(frame.type).toBe("frame");
        [result.ids.logs, result.ids.alerts, result.edges[0]].forEach(member => {
            expect(result.scene.find(element => element.id === member)?.frameId).toBe(frame.id);
        });
    });

    it("changes an edge's label and arrowheads", async () => {
        const { scene, arrowBetween } = await setup();
        const arrow = arrowBetween("api", "db");
        const result = await edit(scene, {
            update: [{ id: arrow, label: "SQL", heads: "both", style: "dashed" }],
        });
        const read = DiagramReader.read(live(result.scene), live(result.scene), { ids: "element" });
        const edge = read.spec!.edges[read.arrowOf.indexOf(arrow)];
        expect(edge).toMatchObject({ label: "SQL", heads: "both", style: "dashed" });
    });

    it("draws a block again from its new content", async () => {
        const { scene, id } = await setup();
        const before = scene.find(element => element.id === id("owners")) as ExcalidrawElement & {
            fileId: string;
        };
        const result = await edit(scene, {
            update: [
                {
                    id: id("owners"),
                    rows: [
                        ["Part", "Owner"],
                        ["API", "Team A"],
                    ],
                },
            ],
        });
        const after = result.scene.find(element => element.id === id("owners")) as typeof before;
        expect(after.fileId).not.toBe(before.fileId);
        expect((after.customData as { rows: string[][] }).rows).toEqual([
            ["Part", "Owner"],
            ["API", "Team A"],
        ]);
        expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
    });
});
