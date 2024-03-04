import { toMilliseconds } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import EventEmitter from "node:events";
import { Board, BoardDeltaUpdate, createLogger, DeltaUpdateUtil, Slug } from "utils";
import { ExcalidrawSimpleElement } from "../../../utils/src/model/excalidraw-simple-element";
import { DrawRepository } from "../repositories/DrawRepository";

const logger = createLogger("DrawingEmitter");
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
        setTimeout(
            async () => {
                const board = this.boardsMap.get(slug);

                if (board) {
                    await DrawRepository.saveDrawingFromBoard(slug, board);
                }

                clearInterval(this.saveIntervalMap.get(slug));
                this.saveIntervalMap.delete(slug);
                this.boardsMap.delete(slug);
            },
            toMilliseconds({ seconds: 30 })
        );
    }

    async update(slug: Slug, deltaUpdate: BoardDeltaUpdate) {
        let board = this.boardsMap.get(slug);

        if (!board) {
            logger.info(`Drawing not found in memory: ${slug}`);
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
        }

        const updatedBoard = DeltaUpdateUtil.applyToBoard({
            board,
            deltaUpdate,
            isOnClient: false,
        });
        this.boardsMap.set(slug, updatedBoard);
        this.emit("update", slug, deltaUpdate);
    }

    async get(slug: Slug): Promise<Board> {
        const board = this.boardsMap.get(slug);
        if (board) return board;

        const elements = await DrawRepository.getDrawingBySlug(slug);

        if (!elements.success) {
            logger.error(`Failed to get drawing: ${slug}`);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: elements.message,
            });
        }
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
