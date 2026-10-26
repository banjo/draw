import { toMilliseconds } from "@banjoanton/utils";
import {
    Board,
    BoardDeltaUpdate,
    DeltaUpdateUtil,
    ExcalidrawSimpleElement,
    Result,
    Slug,
} from "common";
import EventEmitter from "node:events";
import { createContextLogger } from "../lib/context-logger";
import { DrawRepository } from "../repositories/draw-repository";

const logger = createContextLogger("drawing-emitter");

const SAVE_INTERVAL = toMilliseconds({ minutes: 1 });
const EVICT_DELAY = toMilliseconds({ seconds: 30 });
const KEEP_DELETED_FOR = toMilliseconds({ days: 1 });

/** A drawing that is open, kept in memory and saved to the database now and then. */
type Session = {
    board: Board;
    subscribers: number;
    /** Changed since the last save */
    dirty: boolean;
    saveInterval: ReturnType<typeof setInterval>;
    evictTimer?: ReturnType<typeof setTimeout>;
};

/**
 * Holds open drawings in memory. Changes are applied here and sent to everyone on the
 * drawing, and the board is saved every minute and when the last person leaves.
 *
 * Listen to changes for one drawing with `on(DrawingEmitter.updateEvent(slug), listener)`,
 * which gets the change and the connection that sent it.
 */
export class DrawingEmitter extends EventEmitter {
    private sessions = new Map<Slug, Session>();
    private loading = new Map<Slug, Promise<Session | undefined>>();
    private saving = new Map<Slug, Promise<void>>();

    constructor(
        private options = {
            saveInterval: SAVE_INTERVAL,
            evictDelay: EVICT_DELAY,
            keepDeletedFor: KEEP_DELETED_FOR,
        }
    ) {
        super();
        // One listener per person on a drawing, so the default limit of 10 is too low
        this.setMaxListeners(0);
    }

    static updateEvent(slug: Slug) {
        return `update:${slug}`;
    }

    /** Open a drawing for a subscriber. Returns false if the drawing doesn't exist. */
    async join(slug: Slug): Promise<boolean> {
        const session = await this.load(slug);
        if (!session) return false;

        session.subscribers++;
        clearTimeout(session.evictTimer);
        session.evictTimer = undefined;

        return true;
    }

    getBoard(slug: Slug): Board | undefined {
        return this.sessions.get(slug)?.board;
    }

    leave(slug: Slug) {
        const session = this.sessions.get(slug);
        if (!session) return;

        session.subscribers = Math.max(0, session.subscribers - 1);
        if (session.subscribers === 0) {
            this.scheduleEvict(slug, session);
        }
    }

    /** `origin` is the connection that sent the change, which doesn't need it back. */
    async update(slug: Slug, deltaUpdate: BoardDeltaUpdate, origin?: string) {
        const session = await this.load(slug);
        if (!session) return Result.error("Drawing not found");

        session.board = DeltaUpdateUtil.applyToBoard({ board: session.board, deltaUpdate });
        session.dirty = true;
        this.emit(DrawingEmitter.updateEvent(slug), deltaUpdate, origin);

        // Changed without anyone subscribed, so save it and free the memory later
        if (session.subscribers === 0 && !session.evictTimer) {
            this.scheduleEvict(slug, session);
        }

        logger.trace({ slug }, "Drawing updated");
        return Result.ok();
    }

    /** Save all open drawings, e.g. before the server stops. */
    async saveAll() {
        await Promise.all([...this.sessions.keys()].map(slug => this.save(slug)));
    }

    private load(slug: Slug): Promise<Session | undefined> {
        const session = this.sessions.get(slug);
        if (session) return Promise.resolve(session);

        // Share one load between everyone opening the drawing at the same time
        const pending = this.loading.get(slug);
        if (pending) return pending;

        const loading = this.loadFromDatabase(slug).finally(() => this.loading.delete(slug));
        this.loading.set(slug, loading);
        return loading;
    }

    private async loadFromDatabase(slug: Slug): Promise<Session | undefined> {
        const result = await DrawRepository.getDrawingBySlug(slug);

        if (!result.success) {
            logger.error({ slug, message: result.message }, "Could not load drawing");
            return undefined;
        }

        const session: Session = {
            board: {
                elements: result.data.map(element => ExcalidrawSimpleElement.from(element.data)),
            },
            subscribers: 0,
            dirty: false,
            saveInterval: setInterval(() => this.save(slug), this.options.saveInterval),
        };

        this.sessions.set(slug, session);
        logger.trace({ slug }, "Drawing loaded");
        return session;
    }

    /** Save a drawing if it changed. Saves of the same drawing run one after the other. */
    private save(slug: Slug): Promise<void> {
        const previous = this.saving.get(slug) ?? Promise.resolve();
        const next = previous.then(() => this.saveNow(slug));

        this.saving.set(slug, next);
        void next.then(() => {
            if (this.saving.get(slug) === next) this.saving.delete(slug);
        });

        return next;
    }

    private async saveNow(slug: Slug) {
        const session = this.sessions.get(slug);
        if (!session?.dirty) return;

        const board = DeltaUpdateUtil.removeOldDeletedElements(
            session.board,
            this.options.keepDeletedFor
        );
        session.board = board;
        session.dirty = false;

        const result = await DrawRepository.saveDrawingFromBoard(slug, board).catch(
            (error: unknown) => Result.error(String(error))
        );

        if (!result.success) {
            // Try again with the next save
            session.dirty = true;
            logger.error({ slug, message: result.message }, "Could not save drawing");
            return;
        }

        logger.trace({ slug }, "Drawing saved");
    }

    private scheduleEvict(slug: Slug, session: Session) {
        clearTimeout(session.evictTimer);
        session.evictTimer = setTimeout(() => this.evict(slug, session), this.options.evictDelay);
    }

    private async evict(slug: Slug, session: Session) {
        session.evictTimer = undefined;
        if (session.subscribers > 0) return;

        await this.save(slug);

        // Someone opened or changed it during the save
        if (this.sessions.get(slug) !== session || session.subscribers > 0) return;
        if (session.dirty) {
            this.scheduleEvict(slug, session);
            return;
        }

        clearInterval(session.saveInterval);
        this.sessions.delete(slug);
        logger.trace({ slug }, "Drawing removed from memory");
    }
}
