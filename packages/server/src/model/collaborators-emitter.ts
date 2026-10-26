import { Collaborator, Slug } from "common";
import EventEmitter from "node:events";

/**
 * Holds the cursors of the people on each drawing, by WebSocket connection. Listen to changes for
 * one drawing with `on(CollaboratorsEmitter.changeEvent(slug), listener)`, which gets the list.
 */
export class CollaboratorsEmitter extends EventEmitter {
    private collaboratorsMap = new Map<Slug, Collaborator[]>();

    constructor() {
        super();
        // One listener per person on a drawing, so the default limit of 10 is too low
        this.setMaxListeners(0);
    }

    static changeEvent(slug: Slug) {
        return `change:${slug}`;
    }

    update(slug: Slug, collaborator: Collaborator) {
        const collaborators = this.collaboratorsMap.get(slug) ?? [];
        const index = collaborators.findIndex(c => c.id === collaborator.id);
        if (index === -1) {
            collaborators.push(collaborator);
        } else {
            collaborators[index] = collaborator;
        }
        this.collaboratorsMap.set(slug, collaborators);
        this.emit(CollaboratorsEmitter.changeEvent(slug), collaborators);
    }

    remove(slug: Slug, id: string) {
        const collaborators = this.collaboratorsMap.get(slug);
        if (!collaborators) return;

        const remaining = collaborators.filter(c => c.id !== id);
        if (remaining.length === collaborators.length) return;

        if (remaining.length === 0) {
            this.collaboratorsMap.delete(slug);
        } else {
            this.collaboratorsMap.set(slug, remaining);
        }
        this.emit(CollaboratorsEmitter.changeEvent(slug), remaining);
    }

    get(slug: Slug): Collaborator[] {
        return this.collaboratorsMap.get(slug) ?? [];
    }
}
