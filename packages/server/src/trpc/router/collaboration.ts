import { observable } from "@trpc/server/observable";
import {
    BoardDeltaUpdate,
    BoardDeltaUpdateSchema,
    BoardUpdateResponse,
    Collaborator,
    CollaboratorSchema,
    Slug,
} from "common";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { CollaboratorsEmitter } from "../../model/collaborators-emitter";
import { DrawingEmitter } from "../../model/drawing-emitter";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createContextLogger("collaboration-router");

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
            collaboratorsEmitter.update(slug, collaborator);
        }),
    updateBoard: publicProcedure
        .input(
            z.object({
                deltaBoardUpdate: BoardDeltaUpdateSchema,
                slug: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const { deltaBoardUpdate, slug } = input;
            logger.trace({ slug }, "Updating board");
            await drawingEmitter.update(slug, deltaBoardUpdate);
        }),
    onCollaboratorChange: publicProcedure
        .input(z.object({ slug: z.string(), clientId: z.string() }))
        .subscription(({ input }) => {
            const { slug: selectedSlug, clientId } = input;
            return observable<Collaborator[]>(emit => {
                const onUpdate = (slug: Slug) => {
                    if (slug !== selectedSlug) return;

                    const all = collaboratorsEmitter.get(slug) ?? [];
                    emit.next(all);
                };

                const onLeave = (slug: Slug, clientId: string) => {
                    if (slug !== selectedSlug) return;

                    const all = collaboratorsEmitter.get(slug) ?? [];

                    // Remove the collaborator from the list
                    const index = all.findIndex(c => c.clientId === clientId);
                    if (index !== -1) {
                        all.splice(index, 1);
                        emit.next(all);
                    }
                };

                collaboratorsEmitter.on("update", onUpdate);
                collaboratorsEmitter.on("remove", onUpdate);

                return () => {
                    onLeave(selectedSlug, clientId);
                    collaboratorsEmitter.off("update", onUpdate);
                    collaboratorsEmitter.off("remove", onUpdate);
                };
            });
        }),
    onBoardChange: publicProcedure
        .input(z.object({ slug: z.string() }))
        .subscription(async ({ input }) => {
            const { slug: selectedSlug } = input;

            const board = await drawingEmitter.get(selectedSlug);

            return observable<BoardUpdateResponse>(emit => {
                const fullBoard = BoardUpdateResponse.from(board);
                emit.next(fullBoard);

                const onUpdate = (slug: Slug, deltaUpdate: BoardDeltaUpdate) => {
                    if (slug !== selectedSlug) return;
                    const delta = BoardUpdateResponse.from(deltaUpdate);
                    emit.next(delta);
                };

                const onLeave = (slug: Slug) => {
                    if (slug !== selectedSlug) return;

                    const activeCollaborators = collaboratorsEmitter.activeCollaborators(slug);

                    if (activeCollaborators === 0) {
                        drawingEmitter.complete(slug);
                    }
                };

                drawingEmitter.on("update", onUpdate);
                return async () => {
                    onLeave(selectedSlug);
                    drawingEmitter.off("update", onUpdate);
                };
            });
        }),
});
