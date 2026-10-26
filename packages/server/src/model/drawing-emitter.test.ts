import { Board, BoardDeltaUpdate, Result } from "common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawRepository } from "../repositories/draw-repository";
import { DrawingEmitter } from "./drawing-emitter";

vi.mock("../lib/context-logger", () => {
    const noop = () => {};
    const logger = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop };
    return { createContextLogger: () => logger };
});

vi.mock("../repositories/draw-repository", () => ({
    DrawRepository: {
        getDrawingBySlug: vi.fn(),
        saveDrawingFromBoard: vi.fn(),
    },
}));

const getDrawingBySlug = vi.mocked(DrawRepository.getDrawingBySlug);
const saveDrawingFromBoard = vi.mocked(DrawRepository.saveDrawingFromBoard);

const SAVE_INTERVAL = 60_000;
const EVICT_DELAY = 30_000;
const DAY = 24 * 60 * 60 * 1000;

const element = (id: string, version = 1, props: Record<string, unknown> = {}) => ({
    id,
    version,
    versionNonce: 1,
    isDeleted: false,
    ...props,
});

const delta = (...elements: ReturnType<typeof element>[]): BoardDeltaUpdate => ({
    excalidrawElements: elements,
    clientId: "00000000-0000-4000-8000-000000000000",
});

// Rows as the repository returns them, of which the emitter only reads `data`
const rows = (...elements: ReturnType<typeof element>[]) =>
    elements.map(data => ({ data })) as never;

const ids = (board: Board | undefined) => board?.elements.map(e => e.id);

/** A promise you resolve yourself, to control when the database answers. */
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => {
        resolve = r;
    });
    return { promise, resolve };
};

const savedSlugs = () => saveDrawingFromBoard.mock.calls.map(([slug]) => slug);

let emitter: DrawingEmitter;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10 * DAY);
    getDrawingBySlug.mockReset().mockResolvedValue(Result.ok(rows(element("a"))));
    saveDrawingFromBoard.mockReset().mockResolvedValue(Result.ok(1));
    emitter = new DrawingEmitter({
        saveInterval: SAVE_INTERVAL,
        evictDelay: EVICT_DELAY,
        keepDeletedFor: DAY,
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("loading", () => {
    it("loads a drawing once when changes arrive at the same time", async () => {
        const load = deferred<Awaited<ReturnType<typeof DrawRepository.getDrawingBySlug>>>();
        getDrawingBySlug.mockReturnValue(load.promise);

        const first = emitter.update("s", delta(element("b")));
        const second = emitter.update("s", delta(element("c")));
        const joined = emitter.join("s");
        load.resolve(Result.ok(rows(element("a"))));
        await Promise.all([first, second, joined]);

        expect(getDrawingBySlug).toHaveBeenCalledTimes(1);
        expect(ids(emitter.getBoard("s"))).toEqual(["a", "b", "c"]);
    });

    it("returns an error for a drawing that doesn't exist", async () => {
        getDrawingBySlug.mockResolvedValue(Result.error("Drawing not found"));

        expect(await emitter.join("missing")).toBe(false);
        expect((await emitter.update("missing", delta(element("b")))).success).toBe(false);
    });
});

describe("updates", () => {
    it("only notifies listeners of the same drawing", async () => {
        const onS = vi.fn();
        const onOther = vi.fn();
        emitter.on(DrawingEmitter.updateEvent("s"), onS);
        emitter.on(DrawingEmitter.updateEvent("other"), onOther);

        await emitter.update("s", delta(element("b")));

        expect(onS).toHaveBeenCalledTimes(1);
        expect(onOther).not.toHaveBeenCalled();
    });
});

describe("saving", () => {
    it("saves changes every interval, and only when something changed", async () => {
        await emitter.join("s");
        await emitter.update("s", delta(element("b")));

        await vi.advanceTimersByTimeAsync(SAVE_INTERVAL);
        await vi.advanceTimersByTimeAsync(SAVE_INTERVAL);

        expect(saveDrawingFromBoard).toHaveBeenCalledTimes(1);
    });

    it("tries again after a failed save", async () => {
        saveDrawingFromBoard.mockResolvedValueOnce(Result.error("database down"));
        await emitter.join("s");
        await emitter.update("s", delta(element("b")));

        await vi.advanceTimersByTimeAsync(SAVE_INTERVAL);
        await vi.advanceTimersByTimeAsync(SAVE_INTERVAL);

        expect(saveDrawingFromBoard).toHaveBeenCalledTimes(2);
    });

    it("saves every open drawing with saveAll", async () => {
        await emitter.join("s");
        await emitter.join("t");
        await emitter.update("s", delta(element("b")));
        await emitter.update("t", delta(element("c")));

        await emitter.saveAll();

        expect(savedSlugs().sort()).toEqual(["s", "t"]);
    });

    it("removes elements deleted more than a day ago when saving", async () => {
        await emitter.join("s");
        await emitter.update(
            "s",
            delta(
                element("old", 2, { isDeleted: true, updated: Date.now() - DAY - 1 }),
                element("recent", 2, { isDeleted: true, updated: Date.now() - 1000 }),
                element("unknown-age", 2, { isDeleted: true })
            )
        );

        await emitter.saveAll();

        const [, board] = saveDrawingFromBoard.mock.calls[0] ?? [];
        expect(ids(board)).toEqual(["a", "recent", "unknown-age"]);
    });
});

describe("leaving", () => {
    it("saves and frees the drawing a while after the last person leaves", async () => {
        await emitter.join("s");
        await emitter.update("s", delta(element("b")));
        emitter.leave("s");

        await vi.advanceTimersByTimeAsync(EVICT_DELAY);

        expect(saveDrawingFromBoard).toHaveBeenCalledTimes(1);
        expect(emitter.getBoard("s")).toBeUndefined();

        // The save interval is gone too
        await vi.advanceTimersByTimeAsync(SAVE_INTERVAL * 3);
        expect(saveDrawingFromBoard).toHaveBeenCalledTimes(1);
    });

    it("keeps the drawing when someone comes back before it's freed", async () => {
        await emitter.join("s");
        emitter.leave("s");
        await vi.advanceTimersByTimeAsync(EVICT_DELAY / 2);

        await emitter.join("s");
        await vi.advanceTimersByTimeAsync(EVICT_DELAY * 2);

        expect(emitter.getBoard("s")).toBeDefined();
        expect(getDrawingBySlug).toHaveBeenCalledTimes(1);
    });

    it("keeps the drawing when someone joins during the last save", async () => {
        const save = deferred<Awaited<ReturnType<typeof DrawRepository.saveDrawingFromBoard>>>();
        saveDrawingFromBoard.mockReturnValueOnce(save.promise);
        await emitter.join("s");
        await emitter.update("s", delta(element("b")));
        emitter.leave("s");

        await vi.advanceTimersByTimeAsync(EVICT_DELAY);
        await emitter.join("s");
        save.resolve(Result.ok(1));
        await vi.advanceTimersByTimeAsync(0);

        expect(ids(emitter.getBoard("s"))).toEqual(["a", "b"]);
    });

    it("saves changes that arrive during the last save before freeing the drawing", async () => {
        const save = deferred<Awaited<ReturnType<typeof DrawRepository.saveDrawingFromBoard>>>();
        saveDrawingFromBoard.mockReturnValueOnce(save.promise);
        await emitter.join("s");
        await emitter.update("s", delta(element("b")));
        emitter.leave("s");

        await vi.advanceTimersByTimeAsync(EVICT_DELAY);
        await emitter.update("s", delta(element("c")));
        save.resolve(Result.ok(1));
        await vi.advanceTimersByTimeAsync(EVICT_DELAY);

        const lastBoard = saveDrawingFromBoard.mock.calls.at(-1)?.[1];
        expect(ids(lastBoard)).toEqual(["a", "b", "c"]);
        expect(emitter.getBoard("s")).toBeUndefined();
    });

    it("saves and frees a drawing that was changed without anyone subscribed", async () => {
        await emitter.update("s", delta(element("b")));

        await vi.advanceTimersByTimeAsync(EVICT_DELAY);

        expect(saveDrawingFromBoard).toHaveBeenCalledTimes(1);
        expect(emitter.getBoard("s")).toBeUndefined();
    });
});
