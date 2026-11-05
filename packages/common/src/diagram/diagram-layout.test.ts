import { describe, expect, it } from "vitest";
import { DiagramSpec } from "../model/ai";
import { ExcalidrawElement } from "../model/excalidraw-element";
import { DiagramBuilder } from "./diagram-builder";
import { DiagramLayout, FRAME_LABEL } from "./diagram-layout";
import { ElementBounds } from "./element-bounds";
import { Box, Point } from "./element-factory";
import { WEBSHOP } from "./fixtures/webshop";

const intersects = (a: Box, b: Box) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const shrink = (box: Box, by: number): Box => ({
    x: box.x + by,
    y: box.y + by,
    width: box.width - by * 2,
    height: box.height - by * 2,
});

type Arrow = ExcalidrawElement & {
    points: [number, number][];
    startBinding: { elementId: string } | null;
    endBinding: { elementId: string } | null;
};

/** What's wrong with a built diagram's layout, in words, so a failure says what to look at */
const findProblems = async (spec: DiagramSpec) => {
    const { elements } = await DiagramBuilder.build(spec);
    const byId = new Map(elements.map(element => [element.id, element]));
    const nameOf = (id: string) => {
        const element = byId.get(id)!;
        const labelId = element.boundElements?.find(bound => bound.type === "text")?.id;
        const label = labelId && (byId.get(labelId) as { originalText?: string } | undefined);
        return label ? label.originalText : `${element.type} ${id.slice(0, 4)}`;
    };

    const nodes = elements.filter(
        element =>
            element.type !== "arrow" &&
            element.type !== "frame" &&
            !(element.type === "text" && (element as { containerId?: string }).containerId)
    );
    const frames = elements.filter(element => element.type === "frame");
    const arrows = elements.filter(element => element.type === "arrow") as Arrow[];
    const problems: string[] = [];

    nodes.forEach((a, i) =>
        nodes.slice(i + 1).forEach(b => {
            if (intersects(ElementBounds.getBox(a), ElementBounds.getBox(b))) {
                problems.push(`${nameOf(a.id)} overlaps ${nameOf(b.id)}`);
            }
        })
    );

    // A frame with its name above it
    const frameArea = (frame: ExcalidrawElement) => {
        const box = ElementBounds.getBox(frame);
        return { ...box, y: box.y - FRAME_LABEL, height: box.height + FRAME_LABEL };
    };
    frames.forEach((a, i) =>
        frames.slice(i + 1).forEach(b => {
            if (intersects(frameArea(a), frameArea(b))) {
                problems.push(
                    `Frame ${(a as { name?: string }).name} overlaps frame ${(b as { name?: string }).name}`
                );
            }
        })
    );
    frames.forEach(frame =>
        nodes
            .filter(node => node.frameId !== frame.id)
            .forEach(node => {
                if (intersects(frameArea(frame), ElementBounds.getBox(node))) {
                    problems.push(
                        `Frame ${(frame as { name?: string }).name} covers ${nameOf(node.id)}`
                    );
                }
            })
    );

    arrows.forEach(arrow => {
        const points: Point[] = arrow.points.map(([x, y]) => ({ x: arrow.x + x, y: arrow.y + y }));
        const ends = new Set([arrow.startBinding?.elementId, arrow.endBinding?.elementId]);
        const name = `${nameOf(arrow.startBinding!.elementId)} → ${nameOf(arrow.endBinding!.elementId)}`;
        nodes
            .filter(node => !ends.has(node.id))
            .forEach(node => {
                const box = shrink(ElementBounds.getBox(node), 2);
                if (
                    DiagramLayout.getSegments(points).some(segment =>
                        DiagramLayout.crosses(segment, box)
                    )
                ) {
                    problems.push(`Arrow ${name} goes through ${nameOf(node.id)}`);
                }
            });
    });
    return problems;
};

describe("DiagramLayout", () => {
    it("lays out a big diagram without anything in anything else's way", async () => {
        expect(await findProblems(WEBSHOP)).toEqual([]);
    });

    it("does the same top to bottom", async () => {
        expect(await findProblems({ ...WEBSHOP, direction: "down" })).toEqual([]);
    });

    it("puts groups side by side rather than in steps", async () => {
        const { elements, frameOf } = await DiagramBuilder.build(WEBSHOP);
        const boxes = [...frameOf.values()].map(id =>
            ElementBounds.getBox(elements.find(element => element.id === id)!)
        );
        const area = (box: Box) => box.width * box.height;
        const [minX, minY, maxX, maxY] = ElementBounds.getCommonBounds(
            elements.filter(element => element.frameId || element.type === "frame")
        );
        // The frames fill a good part of the space they take up together
        const filled = boxes.reduce((sum, box) => sum + area(box), 0);
        expect(filled / ((maxX - minX) * (maxY - minY))).toBeGreaterThan(0.4);
    });

    it("finds a way at right angles for every arrow, rather than straight across", async () => {
        const { elements } = await DiagramBuilder.build(WEBSHOP);
        const slanted = (elements as Arrow[])
            .filter(element => element.type === "arrow")
            .filter(arrow =>
                arrow.points.slice(1).some(([x, y], i) => {
                    const [px, py] = arrow.points[i]!;
                    return Math.abs(x - px) > 8 && Math.abs(y - py) > 8;
                })
            );
        expect(slanted).toHaveLength(0);
    });

    it("puts arrow labels on a flat stretch, not on a corner", async () => {
        const { elements } = await DiagramBuilder.build(WEBSHOP);
        const labels = elements.filter(
            element =>
                element.type === "text" &&
                elements.find(
                    other => other.id === (element as { containerId?: string }).containerId
                )?.type === "arrow"
        );
        expect(labels.length).toBeGreaterThan(0);
        const misplaced = labels.filter(label => {
            const arrow = elements.find(
                other => other.id === (label as { containerId?: string }).containerId
            ) as Arrow;
            const points = arrow.points.map(([x, y]) => ({ x: arrow.x + x, y: arrow.y + y }));
            const middle = { x: label.x + label.width / 2, y: label.y + label.height / 2 };
            return !DiagramLayout.getSegments(points).some(
                ([a, b]) =>
                    Math.abs(a.y - b.y) < 1 &&
                    Math.abs(middle.y - a.y) < 1 &&
                    Math.min(a.x, b.x) - 1 <= middle.x &&
                    middle.x <= Math.max(a.x, b.x) + 1
            );
        });
        expect(misplaced.map(label => (label as { originalText?: string }).originalText)).toEqual(
            []
        );
    });

    it("spreads arrows that leave the same side of a shape", async () => {
        const { elements, elementOf } = await DiagramBuilder.build(WEBSHOP);
        const gateway = elementOf.get("gateway")!;
        const starts = (elements as Arrow[])
            .filter(
                element => element.type === "arrow" && element.startBinding?.elementId === gateway
            )
            .map(arrow => `${Math.round(arrow.x)},${Math.round(arrow.y)}`);
        expect(new Set(starts).size).toBe(starts.length);
    });
});
