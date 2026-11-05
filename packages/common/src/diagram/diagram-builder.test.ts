// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { DiagramSpec } from "../model/ai";
import { ExcalidrawElement } from "../model/excalidraw-element";
import { DiagramBuilder } from "./diagram-builder";
import { DiagramReader } from "./diagram-reader";

type Restore = (
    elements: readonly unknown[],
    local: null,
    options: { repairBindings: boolean }
) => ExcalidrawElement[];

let restoreElements: Restore;

/** Just enough of a browser for Excalidraw to load: jsdom has no canvas or fonts */
const fakeBrowser = () => {
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ({
        filter: "none",
        font: "",
        measureText: (text: string) => ({ width: text.length * 10 }),
    });
    (globalThis as unknown as { FontFace: unknown }).FontFace = class {
        load() {
            return Promise.resolve(this);
        }
    };
    Object.assign(document, {
        fonts: { add() {}, check: () => true, load: async () => [], forEach() {} },
    });
};

beforeAll(async () => {
    fakeBrowser();
    ({ restoreElements } = (await import("@excalidraw/excalidraw")) as unknown as {
        restoreElements: Restore;
    });
});

const spec: DiagramSpec = {
    direction: "right",
    groups: [{ id: "backend", label: "Backend" }],
    nodes: [
        { id: "title", type: "text", text: "Checkout", size: "large" },
        { id: "web", type: "shape", shape: "rounded", label: "Web app", color: "blue" },
        { id: "api", type: "shape", shape: "hexagon", label: "API", group: "backend" },
        { id: "db", type: "shape", shape: "cylinder", label: "Postgres", group: "backend" },
        { id: "todo", type: "sticky", text: "Add a cache" },
        { id: "notes", type: "note", markdown: "# Notes\n\n- [ ] Retry payments" },
        {
            id: "owners",
            type: "table",
            rows: [
                ["Part", "Owner"],
                ["API", "Team A"],
            ],
        },
        {
            id: "load",
            type: "chart",
            chartType: "line",
            rows: [
                ["", "Load"],
                ["Mon", "3"],
            ],
        },
        { id: "query", type: "code", language: "ts", code: "const a = 1;" },
        { id: "docs", type: "link", url: "https://example.com" },
    ],
    edges: [
        { from: "web", to: "api", label: "HTTPS" },
        { from: "api", to: "db", style: "dashed", heads: "both" },
    ],
};

describe("DiagramBuilder without a browser", () => {
    it("makes elements Excalidraw doesn't need to fill in", async () => {
        const { elements } = await DiagramBuilder.build(spec);
        const restored = restoreElements(elements, null, { repairBindings: true });

        expect(restored).toHaveLength(elements.length);
        // Excalidraw gives each element its place in the order itself, which bumps its version
        const comparable = (element: ExcalidrawElement) => {
            const { index: _, version: __, versionNonce: ___, updated: ____, ...rest } = element;
            return { ...rest, boundElements: rest.boundElements ?? [] };
        };
        restored.forEach((element, i) => {
            expect(comparable(element)).toEqual(comparable(elements[i]!));
        });
    });

    it("binds labels and arrows both ways", async () => {
        const { elements, elementOf } = await DiagramBuilder.build(spec);
        const byId = new Map(elements.map(element => [element.id, element]));

        elements
            .filter(
                element =>
                    element.type === "text" && "containerId" in element && element.containerId
            )
            .forEach(label => {
                const container = byId.get(
                    (label as unknown as { containerId: string }).containerId
                )!;
                expect(container.boundElements).toContainEqual({ type: "text", id: label.id });
            });

        const arrows = elements.filter(element => element.type === "arrow");
        expect(arrows).toHaveLength(2);
        arrows.forEach(arrow => {
            const { startBinding, endBinding } = arrow as unknown as {
                startBinding: { elementId: string };
                endBinding: { elementId: string };
            };
            [startBinding, endBinding].forEach(binding => {
                expect(byId.get(binding.elementId)!.boundElements).toContainEqual({
                    type: "arrow",
                    id: arrow.id,
                });
            });
        });
        const starts = arrows.map(
            arrow =>
                (arrow as unknown as { startBinding: { elementId: string } }).startBinding.elementId
        );
        expect(starts).toContain(elementOf.get("web"));
    });

    it("marks what it couldn't measure, but not code blocks", async () => {
        const { elements } = await DiagramBuilder.build(spec);
        const unmeasured = elements.filter(element => element.customData?.unmeasured);
        const types = new Set(unmeasured.map(element => element.customData?.type));

        expect(types).toEqual(new Set(["text", "markdown", "table", "chart", "link"]));
        expect(
            elements.find(element => element.customData?.type === "codeblock")?.customData
        ).not.toHaveProperty("unmeasured");
    });

    it("measures nothing again when it's given a way to measure", async () => {
        const metrics = {
            measure: (text: string, fontSize: number) => ({
                width: text.length * fontSize,
                height: fontSize,
            }),
            wrap: (text: string) => text,
        };
        const { elements } = await DiagramBuilder.build(spec, { metrics });
        const texts = elements.filter(element => element.type === "text");
        texts.forEach(text => expect(text.customData?.unmeasured).toBeUndefined());
    });

    it("reads back the diagram it made", async () => {
        const { elements, elementOf, frameOf } = await DiagramBuilder.build(spec);
        const read = DiagramReader.read(elements, elements, { ids: "element" });

        expect(read.spec?.nodes).toHaveLength(spec.nodes.length);
        expect(read.spec?.edges).toHaveLength(2);
        expect(read.spec?.edges).toEqual(
            expect.arrayContaining([
                { from: elementOf.get("web"), to: elementOf.get("api"), label: "HTTPS" },
                {
                    from: elementOf.get("api"),
                    to: elementOf.get("db"),
                    style: "dashed",
                    heads: "both",
                },
            ])
        );
        expect(read.spec?.groups).toEqual([{ id: frameOf.get("backend"), label: "Backend" }]);

        const api = read.spec?.nodes.find(node => node.id === elementOf.get("api"));
        expect(api).toEqual({
            id: elementOf.get("api"),
            type: "shape",
            shape: "hexagon",
            label: "API",
            group: frameOf.get("backend"),
        });
        const table = read.spec?.nodes.find(node => node.type === "table");
        expect(table).toMatchObject({
            rows: [
                ["Part", "Owner"],
                ["API", "Team A"],
            ],
        });
        expect(read.skipped).toBe(0);
    });
});
