import { Maybe } from "@banjoanton/utils";
import { TRPCError } from "@trpc/server";
import EventEmitter from "node:events";
import { Board, BoardDeltaUpdate, createLogger, DeltaUpdateUtil, Slug } from "utils";
import { ExcalidrawSimpleElement } from "../../../utils/src/model/excalidraw-simple-element";
import { DrawRepository } from "../repositories/DrawRepository";

const logger = createLogger("DrawingEmitter");

export class DrawingEmitter extends EventEmitter {
    private map: Map<Slug, Board>;

    constructor() {
        super();
        this.map = new Map();
    }

    async update(slug: Slug, deltaUpdate: BoardDeltaUpdate) {
        let board = this.map.get(slug);

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
        this.map.set(slug, updatedBoard);
        this.emit("update", slug, deltaUpdate);
    }

    // TODO: save to db occasionally

    async get(slug: Slug): Promise<Maybe<Board>> {
        const board = this.map.get(slug);
        if (board) return board;

        const elements = await DrawRepository.getDrawingBySlug(slug);

        if (!elements.success) {
            logger.error(`Failed to get drawing: ${slug}`);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: elements.message,
            });
        }

        return Board.fromDatabase(elements.data);
    }
}
