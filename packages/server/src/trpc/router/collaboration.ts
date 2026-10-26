import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
    BoardDeltaUpdate,
    BoardDeltaUpdateSchema,
    BoardUpdateResponse,
    Cause,
    Collaborator,
    CollaboratorSchema,
} from "common";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { CollaboratorsEmitter } from "../../model/collaborators-emitter";
import { DrawingEmitter } from "../../model/drawing-emitter";
import { collaboratorsEmitter, drawingEmitter } from "../../model/emitters";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createContextLogger("collaboration-router");

const drawingNotFound = () =>
    new TRPCError({
        code: "NOT_FOUND",
        message: "Drawing not found",
        cause: Cause.DRAWING_NOT_FOUND,
    });

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
            const result = await drawingEmitter.update(slug, deltaBoardUpdate);

            if (!result.success) {
                throw drawingNotFound();
            }
        }),
    onCollaboratorChange: publicProcedure
        .input(z.object({ slug: z.string(), clientId: z.string() }))
        .subscription(({ input }) => {
            const { slug, clientId } = input;
            const event = CollaboratorsEmitter.changeEvent(slug);

            return observable<Collaborator[]>(emit => {
                const onChange = (collaborators: Collaborator[]) => emit.next(collaborators);

                collaboratorsEmitter.on(event, onChange);
                emit.next(collaboratorsEmitter.get(slug));

                return () => {
                    collaboratorsEmitter.off(event, onChange);
                    // Remove the cursor for everyone else
                    collaboratorsEmitter.remove(slug, clientId);
                };
            });
        }),
    onBoardChange: publicProcedure
        .input(z.object({ slug: z.string() }))
        .subscription(({ input }) => {
            const { slug } = input;
            const event = DrawingEmitter.updateEvent(slug);

            return observable<BoardUpdateResponse>(emit => {
                let joined = false;
                let closed = false;

                const onUpdate = (deltaUpdate: BoardDeltaUpdate) =>
                    emit.next(BoardUpdateResponse.from(deltaUpdate));

                drawingEmitter
                    .join(slug)
                    .then(exists => {
                        if (!exists) {
                            emit.error(drawingNotFound());
                            return;
                        }

                        // Closed while the drawing was loading
                        if (closed) {
                            drawingEmitter.leave(slug);
                            return;
                        }

                        joined = true;
                        // Read the board and listen in the same tick, so no change is missed
                        const board = drawingEmitter.getBoard(slug);
                        if (board) emit.next(BoardUpdateResponse.from(board));
                        drawingEmitter.on(event, onUpdate);
                    })
                    .catch((error: unknown) => {
                        logger.error({ error, slug }, "Could not open drawing");
                        emit.error(new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: error }));
                    });

                return () => {
                    closed = true;
                    if (!joined) return;

                    drawingEmitter.off(event, onUpdate);
                    drawingEmitter.leave(slug);
                };
            });
        }),
});
