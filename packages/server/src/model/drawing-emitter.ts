import { isDefined, partition } from "@banjoanton/utils";
import EventEmitter from "node:events";
import { Board, DeltaBoardUpdate, Slug, createLogger } from "utils";
import { ExcalidrawSimpleElement } from "../../../utils/src/model/excalidraw-simple-element";
import { DrawRepository } from "../repositories/DrawRepository";

const logger = createLogger("DrawingEmitter");

export class DrawingEmitter extends EventEmitter {
    private map: Map<Slug, Board>;

    constructor() {
        super();
        this.map = new Map();
    }

    async update(slug: Slug, deltaUpdate: DeltaBoardUpdate) {
        let board = this.map.get(slug);

        if (!board) {
            logger.info(`Drawing not found in memory: ${slug}`);
            const drawingResult = await DrawRepository.getDrawingBySlug(slug);

            if (!drawingResult.success) {
                logger.error(`Error getting drawing: ${slug}`);
                return;
            }

            board = {
                elements: drawingResult.data.map(ExcalidrawSimpleElement.from),
            };
        }

        const elements = deltaUpdate.excalidrawElements;

        const [deleted, updated] = partition(elements, e => e.isDeleted);
        const toDelete = new Set(deleted.map(e => e.id));
        const toUpdate = new Set(updated.map(e => e.id));

        const updatedBoardElements = board.elements
            .map(e => {
                if (toDelete.has(e.id)) {
                    return undefined;
                }

                if (toUpdate.has(e.id)) {
                    const updatedExcalidrawElement: ExcalidrawSimpleElement =
                        updated.find(u => u.id === e.id) ?? e;

                    return updatedExcalidrawElement;
                }

                return e;
            })
            .filter(isDefined);

        this.map.set(slug, { elements: updatedBoardElements });

        // TODO: return the updated elements to client and do calculations on the client as well
        this.emit("update", slug, deltaUpdate);
    }

    // TODO: save to db occasionally

    get(slug: Slug): Board | undefined {
        return this.map.get(slug);
    }
}
