import { toMilliseconds } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import {
    Board,
    BoardDeltaUpdate,
    Cause,
    createLogger,
    DeltaUpdateUtil,
    LockedElementUtil,
    Slug,
} from "common";
import EventEmitter from "node:events";
import { ExcalidrawSimpleElement } from "../../../common/src/model/excalidraw-simple-element";
import { DrawRepository } from "../repositories/DrawRepository";

const logger = createLogger("DrawingEmitter");
const SAVE_INTERVAL = toMilliseconds({ minutes: 1 });

type UserId = string;
type ElementId = string;
type UserIdWithSlug = `${UserId}-${Slug}`;

const createKey = (userId: UserId, slug: Slug): UserIdWithSlug => `${userId}-${slug}`;

export class DrawingEmitter extends EventEmitter {
    private boardsMap: Map<Slug, Board>;
    private saveIntervalMap: Map<Slug, NodeJS.Timeout>;
    private lockedElementsMap: Map<UserIdWithSlug, ElementId[]>;

    constructor() {
        super();
        this.boardsMap = new Map();
        this.saveIntervalMap = new Map();
        this.lockedElementsMap = new Map();
    }

    clearActiveElements(slug: Slug, userId: UserId) {
        const key = createKey(userId, slug);
        const lockedElements = this.lockedElementsMap.get(key);
        if (!lockedElements) return;

        const board = this.boardsMap.get(slug);
        if (!board) return;

        const { updatedBoard, updatedElements } = LockedElementUtil.restoreBoardLockedElements(
            board,
            lockedElements
        );

        this.boardsMap.set(slug, updatedBoard);
        this.lockedElementsMap.delete(key);

        const order = updatedBoard.elements.map(element => element.id.toString());
        const deltaUpdate = BoardDeltaUpdate.from({
            excalidrawElements: updatedElements,
            order,
            senderId: userId,
        });
        this.emit("update", slug, deltaUpdate);
    }

    // Wait 30 seconds before clearing the board from memory
    complete(slug: Slug) {
        logger.trace(`Completing drawing: ${slug}, will clear in 30 seconds`);
        setTimeout(
            async () => {
                logger.trace(`Saving and clearing drawing: ${slug}`);
                const board = this.boardsMap.get(slug);

                if (board) {
                    const res = await DrawRepository.saveDrawingFromBoard(slug, board);

                    if (!res.success) {
                        logger.error(`Error saving drawing: ${slug}`);
                    }
                } else {
                    logger.error(`Board not found for saving: ${slug}`);
                }

                clearInterval(this.saveIntervalMap.get(slug));
                this.saveIntervalMap.delete(slug);
                this.boardsMap.delete(slug);
                logger.trace(`Drawing cleared from memory: ${slug}`);
            },
            toMilliseconds({ seconds: 30 })
        );
    }

    async update(slug: Slug, deltaUpdate: BoardDeltaUpdate) {
        let board = this.boardsMap.get(slug);

        if (board) {
            logger.trace(`Drawing found in memory: ${slug}`);
        } else {
            logger.trace(`Drawing not found in memory: ${slug}`);
            const drawingResult = await DrawRepository.getDrawingBySlug(slug);

            if (!drawingResult.success) {
                logger.error(`Error getting drawing: ${slug}`);
                return;
            }

            board = {
                elements: drawingResult.data.map(databaseElement =>
                    ExcalidrawSimpleElement.from(databaseElement.data)
                ),
            };
            logger.trace(`Drawing fetched from database: ${slug}`);
        }

        const lockedElementsKey = createKey(deltaUpdate.senderId, slug);
        const previousLockedElements = this.lockedElementsMap.get(lockedElementsKey) ?? [];
        const updatedLockedElements = LockedElementUtil.applyDeltaUpdate(
            previousLockedElements,
            deltaUpdate
        );
        this.lockedElementsMap.set(lockedElementsKey, updatedLockedElements);

        const updatedBoard = DeltaUpdateUtil.applyToBoard({
            board,
            deltaUpdate,
            isOnClient: false,
        });
        this.boardsMap.set(slug, updatedBoard);
        this.emit("update", slug, deltaUpdate);
        logger.trace(`Drawing updated: ${slug}`);
    }

    async get(slug: Slug): Promise<Board> {
        const board = this.boardsMap.get(slug);
        if (board) {
            logger.trace(`Drawing found in memory: ${slug}`);
            return board;
        }

        const elements = await DrawRepository.getDrawingBySlug(slug);

        if (!elements.success) {
            logger.error(`Failed to get drawing: ${slug}`);
            throw new TRPCError({
                code: "NOT_FOUND",
                message: elements.message,
                cause: Cause.DRAWING_NOT_FOUND,
            });
        }
        logger.trace(`Drawing fetched from database: ${slug}`);
        const updatedBoard = Board.fromDatabase(elements.data);

        // clear previous interval and board from memory
        this.saveIntervalMap.delete(slug);
        this.boardsMap.delete(slug);

        this.boardsMap.set(slug, updatedBoard);
        this.saveIntervalMap.set(
            slug,
            setInterval(async () => {
                const latestBoard = this.boardsMap.get(slug);

                if (!latestBoard) {
                    logger.trace(`Board not found for board: ${slug}, clearing interval`);
                    clearInterval(this.saveIntervalMap.get(slug));
                    return;
                }

                await DrawRepository.saveDrawingFromBoard(slug, latestBoard);
            }, SAVE_INTERVAL)
        );

        return updatedBoard;
    }
}
