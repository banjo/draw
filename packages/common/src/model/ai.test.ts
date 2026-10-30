import { describe, expect, it } from "vitest";
import { DiagramSpec, DiagramSpecUtil } from "./ai";

const spec = (changes: Partial<DiagramSpec>): DiagramSpec => ({
    direction: "right",
    groups: [],
    nodes: [],
    edges: [],
    ...changes,
});

describe("DiagramSpecUtil.clean", () => {
    it("drops arrows to nodes that aren't there, and repeated nodes", () => {
        const cleaned = DiagramSpecUtil.clean(
            spec({
                nodes: [
                    { id: "a", type: "shape", shape: "rectangle", label: "A" },
                    { id: "a", type: "shape", shape: "ellipse", label: "Again" },
                    { id: "b", type: "sticky", text: "B" },
                ],
                edges: [
                    { from: "a", to: "b" },
                    { from: "a", to: "missing" },
                ],
            })
        );

        expect(cleaned.nodes.map(node => node.id)).toEqual(["a", "b"]);
        expect(cleaned.edges).toEqual([{ from: "a", to: "b" }]);
    });

    it("drops groups that aren't there or are empty, and groups named like nodes", () => {
        const cleaned = DiagramSpecUtil.clean(
            spec({
                groups: [
                    { id: "api", label: "API" },
                    { id: "empty", label: "Empty" },
                    { id: "a", label: "Same as a node" },
                ],
                nodes: [
                    { id: "a", type: "shape", shape: "rectangle", group: "api" },
                    { id: "b", type: "text", text: "B", group: "gone" },
                ],
            })
        );

        expect(cleaned.groups).toEqual([{ id: "api", label: "API" }]);
        expect(cleaned.nodes[1]?.group).toBeUndefined();
    });
});
