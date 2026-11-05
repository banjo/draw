import { Result } from "common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { drawingEmitter } from "../model/emitters";
import { DrawRepository } from "../repositories/draw-repository";
import { McpDiagramService } from "./mcp-diagram-service";

vi.mock("../lib/context-logger", () => {
    const noop = () => {};
    const logger = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop };
    return { createContextLogger: () => logger };
});

vi.mock("common", async original => ({
    ...(await original<typeof import("common")>()),
    Env: { server: () => ({ CLIENT_URL: "https://draw.test" }) },
}));

vi.mock("../repositories/draw-repository", () => ({
    DrawRepository: {
        getAccessSettings: vi.fn(),
        getDrawingName: vi.fn(),
        createCopy: vi.fn(),
        updateDrawingName: vi.fn(),
        getOwnedDrawings: vi.fn(),
    },
}));

vi.mock("../model/emitters", () => ({
    drawingEmitter: { getLatestBoard: vi.fn(), update: vi.fn() },
}));

vi.mock("./link-preview-service", () => ({
    LinkPreviewService: { getPreview: vi.fn(async (url: string) => ({ url, title: "Page" })) },
}));

const OWNER = 1;
const SLUG = "0f6f9a2e-6a55-4c9e-9f3c-2b0a4d6e8c11";

const getAccessSettings = vi.mocked(DrawRepository.getAccessSettings);
const createCopy = vi.mocked(DrawRepository.createCopy);
const getLatestBoard = vi.mocked(drawingEmitter.getLatestBoard);
const update = vi.mocked(drawingEmitter.update);

let board: { elements: unknown[] } = { elements: [] };

beforeEach(() => {
    board = { elements: [] };
    getAccessSettings
        .mockReset()
        .mockResolvedValue(Result.ok({ ownerId: OWNER, linkAccess: "private" as const }));
    vi.mocked(DrawRepository.getDrawingName).mockResolvedValue(Result.ok("Checkout"));
    createCopy.mockReset().mockImplementation(async ({ elements }) => {
        board = { elements };
        return Result.ok(SLUG);
    });
    getLatestBoard.mockReset().mockImplementation(async () => board as never);
    update.mockReset().mockResolvedValue(Result.ok());
});

const diagram = {
    direction: "right" as const,
    groups: [],
    nodes: [
        { id: "web", type: "shape" as const, shape: "rectangle" as const, label: "Web" },
        { id: "api", type: "shape" as const, shape: "rectangle" as const, label: "API" },
    ],
    edges: [{ from: "web", to: "api" }],
};

describe("McpDiagramService", () => {
    it("creates a drawing in the user's collection and reads it back", async () => {
        const created = await McpDiagramService.create(OWNER, { name: "Checkout", diagram });
        expect(created).toMatchObject({ slug: SLUG, appUrl: `https://draw.test/draw/${SLUG}` });
        expect(createCopy).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Checkout", ownerId: OWNER })
        );

        const read = await McpDiagramService.get(OWNER, SLUG);
        expect(read.diagram.nodes.map(node => node.id).sort()).toEqual(
            [created.ids.web, created.ids.api].sort()
        );
        expect(read.diagram.edges).toEqual([
            expect.objectContaining({ from: created.ids.web, to: created.ids.api }),
        ]);
        expect(read.other).toEqual({ count: 0, summary: "nothing" });
    });

    it("says another user's drawing isn't there", async () => {
        await expect(McpDiagramService.get(2, SLUG)).rejects.toThrow("Drawing not found");
        await expect(McpDiagramService.update(2, { slug: SLUG, remove: ["x"] })).rejects.toThrow(
            "Drawing not found"
        );
        expect(update).not.toHaveBeenCalled();
    });

    it("sends changes to everyone on the drawing", async () => {
        const created = await McpDiagramService.create(OWNER, { name: "Checkout", diagram });
        const result = await McpDiagramService.update(OWNER, {
            slug: SLUG,
            update: [{ id: created.ids.api!, label: "API v2" }],
        });
        expect(result.slug).toBe(SLUG);
        expect(update).toHaveBeenCalledWith(SLUG, {
            excalidrawElements: expect.arrayContaining([
                expect.objectContaining({ originalText: "API v2", containerId: created.ids.api }),
            ]),
        });
    });

    it("changes nothing when an id is unknown", async () => {
        await McpDiagramService.create(OWNER, { name: "Checkout", diagram });
        await expect(
            McpDiagramService.update(OWNER, { slug: SLUG, remove: ["missing"] })
        ).rejects.toThrow("Unknown id: missing");
        expect(update).not.toHaveBeenCalled();
    });
});
