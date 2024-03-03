import EventEmitter from "node:events";
import { Collaborator, Slug } from "utils";

export class CollaboratorsEmitter extends EventEmitter {
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
