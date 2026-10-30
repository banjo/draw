import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
    BoardDeltaUpdate,
    BoardDeltaUpdateSchema,
    BoardUpdateResponse,
    Collaborator,
    CollaboratorUpdateSchema,
    DrawingAccess,
    ExistingSlugSchema,
} from "common";
import { z } from "zod";
import { createContextLogger } from "../../lib/context-logger";
import { CollaboratorsEmitter } from "../../model/collaborators-emitter";
import { DrawingEmitter } from "../../model/drawing-emitter";
import { collaboratorsEmitter, drawingEmitter } from "../../model/emitters";
import { AccessService } from "../../services/access-service";
import { drawingNotFound, noAccess, requireAccess } from "../require-access";
import { createTRPCRouter, publicProcedure, TRPCContext } from "../trpc";

const logger = createContextLogger("collaboration-router");

/** Collaboration identifies each browser tab by its WebSocket connection. */
const getConnectionId = (ctx: TRPCContext) => {
    if (!ctx.connectionId) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Collaboration only works over WebSocket",
        });
    }
    return ctx.connectionId;
};

export const collaborationRouter = createTRPCRouter({
    updateCollaborator: publicProcedure
        .input(z.object({ collaborator: CollaboratorUpdateSchema, slug: ExistingSlugSchema }))
        .mutation(async ({ input, ctx }) => {
            const { collaborator, slug } = input;
            const id = getConnectionId(ctx);
            await requireAccess(slug, ctx.userId, "view");

            // The name and avatar come from the session, never from the client
            collaboratorsEmitter.update(slug, {
                id,
                x: collaborator.x,
                y: collaborator.y,
                name: ctx.user?.name ?? collaborator.name,
                avatarUrl: ctx.user?.avatarUrl ?? undefined,
            });
        }),
    updateBoard: publicProcedure
        .input(z.object({ deltaBoardUpdate: BoardDeltaUpdateSchema, slug: ExistingSlugSchema }))
        .mutation(async ({ input, ctx }) => {
            const { deltaBoardUpdate, slug } = input;
            const origin = getConnectionId(ctx);
            await requireAccess(slug, ctx.userId, "edit");
            logger.trace({ slug }, "Updating board");

            const result = await drawingEmitter.update(slug, deltaBoardUpdate, origin);

            if (!result.success) {
                throw drawingNotFound();
            }
        }),
    onCollaboratorChange: publicProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .subscription(async ({ input, ctx }) => {
            const { slug } = input;
            const id = getConnectionId(ctx);
            await requireAccess(slug, ctx.userId, "view");
            const event = CollaboratorsEmitter.changeEvent(slug);

            return observable<Collaborator[]>(emit => {
                // Everyone except yourself. Your own moves don't change that list, so they
                // aren't sent back to you.
                let last: string | undefined;
                const onChange = (collaborators: Collaborator[]) => {
                    const others = collaborators.filter(c => c.id !== id);
                    const key = JSON.stringify(others);
                    if (key === last) return;
                    last = key;
                    emit.next(others);
                };

                collaboratorsEmitter.on(event, onChange);
                onChange(collaboratorsEmitter.get(slug));

                const stopWatchingAccess = AccessService.onRoleChange(slug, ctx.userId, role => {
                    if (!DrawingAccess.canView(role)) emit.error(noAccess());
                });

                return () => {
                    stopWatchingAccess();
                    collaboratorsEmitter.off(event, onChange);
                    // Remove the cursor for everyone else
                    collaboratorsEmitter.remove(slug, id);
                };
            });
        }),
    onBoardChange: publicProcedure
        .input(z.object({ slug: ExistingSlugSchema }))
        .subscription(async ({ input, ctx }) => {
            const { slug } = input;
            const connectionId = getConnectionId(ctx);
            await requireAccess(slug, ctx.userId, "view");
            const event = DrawingEmitter.updateEvent(slug);

            return observable<BoardUpdateResponse>(emit => {
                let joined = false;
                let closed = false;

                const onUpdate = (deltaUpdate: BoardDeltaUpdate, origin?: string) => {
                    // The sender already has its own change
                    if (origin === connectionId) return;
                    emit.next(BoardUpdateResponse.from(deltaUpdate));
                };

                // The owner changed who can open the drawing while it's open
                const stopWatchingAccess = AccessService.onRoleChange(slug, ctx.userId, role => {
                    if (!DrawingAccess.canView(role)) {
                        emit.error(noAccess());
                        return;
                    }
                    emit.next(BoardUpdateResponse.access(role));
                });

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
                    stopWatchingAccess();
                    if (!joined) return;

                    drawingEmitter.off(event, onUpdate);
                    drawingEmitter.leave(slug);
                };
            });
        }),
});
