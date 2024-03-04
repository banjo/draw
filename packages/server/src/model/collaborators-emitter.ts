import EventEmitter from "node:events";
import { Collaborator, Slug } from "utils";

export class CollaboratorsEmitter extends EventEmitter {
    private collaboratorsMap: Map<Slug, Collaborator[]>;

    constructor() {
        super();
        this.collaboratorsMap = new Map();
    }

    activeCollaborators(slug: Slug) {
        return this.collaboratorsMap.get(slug)?.length ?? 0;
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
        this.emit("update", slug, collaborator);
    }

    remove(slug: Slug, id: string) {
        const collaborators = this.collaboratorsMap.get(slug) ?? [];
        const index = collaborators.findIndex(c => c.id === id);
        if (index !== -1) {
            collaborators.splice(index, 1);
            this.collaboratorsMap.set(slug, collaborators);
            this.emit("remove", slug, id);
        }

        if (collaborators.length === 0) {
            this.collaboratorsMap.delete(slug);
        }
    }

    get(slug: Slug): Collaborator[] | undefined {
        return this.collaboratorsMap.get(slug);
    }
}
