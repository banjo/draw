import { observable } from "@trpc/server/observable";
import EventEmitter from "node:events";
import { createLogger } from "utils";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const logger = createLogger("CollaborationRouter");

type Collaborator = {
    x: number;
    y: number;
    name: string;
    avatarUrl: string;
    id: string;
    latestPointerUpdate: number;
};

type Slug = string;

class Collaborators extends EventEmitter {
    private map: Map<Slug, Collaborator[]>;

    constructor() {
        super();
        this.map = new Map();
    }

    update(slug: Slug, collaborator: Collaborator) {
        const collaborators = this.map.get(slug) ?? [];
        const index = collaborators.findIndex(c => c.id === collaborator.id);
        if (index === -1) {
            collaborators.push(collaborator);
        } else {
            collaborators[index] = collaborator;
        }
        this.map.set(slug, collaborators);
        this.emit("update", slug, collaborator);
    }

    remove(slug: Slug, id: string) {
        const collaborators = this.map.get(slug) ?? [];
        const index = collaborators.findIndex(c => c.id === id);
        if (index !== -1) {
            collaborators.splice(index, 1);
            this.map.set(slug, collaborators);
            this.emit("remove", slug, id);
        }

        if (collaborators.length === 0) {
            this.map.delete(slug);
        }
    }

    get(slug: Slug): Collaborator[] | undefined {
        return this.map.get(slug);
    }
}

const collaborators = new Collaborators();

export const collaborationRouter = createTRPCRouter({
    updateCollaborator: publicProcedure
        .input(
            z.object({
                x: z.number(),
                y: z.number(),
                name: z.string(),
                avatarUrl: z.string(),
                slug: z.string(),
                id: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const { x, y, name, avatarUrl, slug, id } = input;
            logger.trace(`Updating collaborator ${name} to ${slug}`);

            const entity: Collaborator = {
                x,
                y,
                name,
                avatarUrl,
                id,
                latestPointerUpdate: Date.now(),
            };
            collaborators.update(slug, entity);

            return entity;
        }),
    onChange: publicProcedure
        .input(z.object({ slug: z.string(), id: z.string() }))
        .subscription(({ input }) => {
            const { slug: selectedSlug, id } = input;
            return observable<Collaborator[]>(emit => {
                const onUpdate = (slug: Slug) => {
                    if (slug !== selectedSlug) return;

                    const all = collaborators.get(slug) ?? [];
                    emit.next(all);
                };

                const onLeave = (slug: Slug, id: string) => {
                    if (slug !== selectedSlug) return;

                    const all = collaborators.get(slug) ?? [];
                    const index = all.findIndex(c => c.id === id);
                    if (index !== -1) {
                        all.splice(index, 1);
                        emit.next(all);
                    }
                };

                collaborators.on("update", onUpdate);
                collaborators.on("remove", onUpdate);

                return () => {
                    onLeave(selectedSlug, id);
                    collaborators.off("update", onUpdate);
                    collaborators.off("remove", onUpdate);
                };
            });
        }),
});
