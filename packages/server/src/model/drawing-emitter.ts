import { toMilliseconds } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import { Board, BoardDeltaUpdate, Cause, DeltaUpdateUtil, Slug } from "common";
import EventEmitter from "node:events";
import { ExcalidrawSimpleElement } from "../../../common/src/model/excalidraw-simple-element";
import { createContextLogger } from "../lib/context-logger";
import { DrawRepository } from "../repositories/draw-repository";

const logger = createContextLogger("drawing-emitter");
const SAVE_INTERVAL = toMilliseconds({ minutes: 1 });

export class DrawingEmitter extends EventEmitter {
    private boardsMap: Map<Slug, Board>;
    private saveIntervalMap: Map<Slug, NodeJS.Timeout>;

    constructor() {
        super();
        this.boardsMap = new Map();
        this.saveIntervalMap = new Map();
    }

    // Wait 30 seconds before clearing the board from memory
    complete(slug: Slug) {
        logger.trace({ slug }, `Completing drawing, will clear in 30 seconds`);
        setTimeout(
            async () => {
                logger.trace({ slug }, "Saving and clearing drawing");
                const board = this.boardsMap.get(slug);

                if (board) {
                    const res = await DrawRepository.saveDrawingFromBoard(slug, board);

                    if (!res.success) {
                        logger.error({ slug, message: res.message }, "Error saving drawing");
                    }
                } else {
                    logger.error({ slug }, "Board not found in memory while saving drawing");
                }

                clearInterval(this.saveIntervalMap.get(slug));
                this.saveIntervalMap.delete(slug);
                this.boardsMap.delete(slug);
                logger.trace({ slug }, "Drawing cleared from memory");
            },
            toMilliseconds({ seconds: 30 })
        );
    }

    async update(slug: Slug, deltaUpdate: BoardDeltaUpdate) {
        let board = this.boardsMap.get(slug);

        if (board) {
            logger.trace({ slug }, `Drawing found in memory`);
        } else {
            logger.trace({ slug }, "Drawing not found in memory");
            const drawingResult = await DrawRepository.getDrawingBySlug(slug);

            if (!drawingResult.success) {
                logger.error(
                    { slug, message: drawingResult.message },
                    "Error getting drawing with slug"
                );
                return;
            }

            board = {
                elements: drawingResult.data.map(databaseElement =>
                    ExcalidrawSimpleElement.from(databaseElement.data)
                ),
            };
            logger.trace({ slug }, "Drawing fetched from database");
        }

        const updatedBoard = DeltaUpdateUtil.applyToBoard({
            board,
            deltaUpdate,
            isOnClient: false,
        });
        this.boardsMap.set(slug, updatedBoard);
        this.emit("update", slug, deltaUpdate);
        logger.trace({ slug }, "Drawing updated");
    }

    async get(slug: Slug): Promise<Board> {
        const board = this.boardsMap.get(slug);
        if (board) {
            logger.trace({ slug }, `Drawing found in memory: ${slug}`);
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
        logger.trace({ slug }, "Drawing fetched from database");
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
                    logger.trace({ slug }, `Board not found for board, clearing interval`);
                    clearInterval(this.saveIntervalMap.get(slug));
                    return;
                }

                await DrawRepository.saveDrawingFromBoard(slug, latestBoard);
            }, SAVE_INTERVAL)
        );

        return updatedBoard;
    }
}
