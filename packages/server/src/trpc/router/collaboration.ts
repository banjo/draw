import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
    Board,
    BoardUpdateResponse,
    Collaborator,
    CollaboratorSchema,
    createLogger,
    DeltaBoardUpdateSchema,
    Slug,
} from "utils";
import { z } from "zod";
import { CollaboratorsEmitter } from "../../model/collaborators-emitter";
import { DrawingEmitter } from "../../model/drawing-emitter";
import { DrawRepository } from "../../repositories/DrawRepository";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createLogger("CollaborationRouter");

const collaboratorsEmitter = new CollaboratorsEmitter();
const drawingEmitter = new DrawingEmitter();

export const collaborationRouter = createTRPCRouter({
    updateCollaborator: publicProcedure
        .input(
            z.object({
                collaborator: CollaboratorSchema,
                slug: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const { collaborator, slug } = input;
            logger.trace(`Updating collaborator ${collaborator.name} to ${slug}`);
            collaboratorsEmitter.update(slug, collaborator);
        }),
    updateBoard: publicProcedure
        .input(
            z.object({
                board: DeltaBoardUpdateSchema,
                slug: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const { board, slug } = input;
            logger.trace(`Updating board to ${slug}`);
            await drawingEmitter.update(slug, board);
        }),
    onCollaboratorChange: publicProcedure
        .input(z.object({ slug: z.string(), id: z.string() }))
        .subscription(({ input }) => {
            const { slug: selectedSlug, id } = input;
            return observable<Collaborator[]>(emit => {
                const onUpdate = (slug: Slug) => {
                    if (slug !== selectedSlug) return;

                    const all = collaboratorsEmitter.get(slug) ?? [];
                    emit.next(all);
                };

                const onLeave = (slug: Slug, id: string) => {
                    if (slug !== selectedSlug) return;

                    const all = collaboratorsEmitter.get(slug) ?? [];
                    const index = all.findIndex(c => c.id === id);
                    if (index !== -1) {
                        all.splice(index, 1);
                        emit.next(all);
                    }
                };

                collaboratorsEmitter.on("update", onUpdate);
                collaboratorsEmitter.on("remove", onUpdate);

                return () => {
                    onLeave(selectedSlug, id);
                    collaboratorsEmitter.off("update", onUpdate);
                    collaboratorsEmitter.off("remove", onUpdate);
                };
            });
        }),
    onBoardChange: publicProcedure
        .input(z.object({ slug: z.string(), id: z.string() }))
        .subscription(async ({ input }) => {
            const { slug: selectedSlug } = input;

            const elements = await DrawRepository.getDrawingBySlug(selectedSlug);

            if (!elements.success) {
                logger.error(`Failed to get drawing: ${selectedSlug}`);
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: elements.message });
            }

            const board = Board.fromDatabase(elements.data);

            return observable<BoardUpdateResponse>(emit => {
                const fullBoard = BoardUpdateResponse.from(board);
                emit.next(fullBoard);

                const onUpdate = (slug: Slug) => {
                    if (slug !== selectedSlug) return;

                    const state = drawingEmitter.get(slug);
                    if (!state) {
                        logger.error(`Failed to get drawing: ${slug}`);
                        return;
                    }
                    const delta = BoardUpdateResponse.from(state);
                    emit.next(delta);
                };

                drawingEmitter.on("update", onUpdate);

                return () => {
                    drawingEmitter.off("update", onUpdate);
                };
            });
        }),
});
