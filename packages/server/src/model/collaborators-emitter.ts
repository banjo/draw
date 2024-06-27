import { Collaborator, Slug } from "common";
import EventEmitter from "node:events";

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
        const index = collaborators.findIndex(c => c.clientId === collaborator.clientId);
        if (index === -1) {
            collaborators.push(collaborator);
        } else {
            collaborators[index] = collaborator;
        }
        this.collaboratorsMap.set(slug, collaborators);
        this.emit("update", slug, collaborator);
    }

    remove(slug: Slug, clientId: string) {
        const collaborators = this.collaboratorsMap.get(slug) ?? [];
        const index = collaborators.findIndex(c => c.clientId === clientId);
        if (index !== -1) {
            collaborators.splice(index, 1);
            this.collaboratorsMap.set(slug, collaborators);
            this.emit("remove", slug, clientId);
        }

        if (collaborators.length === 0) {
            this.collaboratorsMap.delete(slug);
        }
    }

    get(slug: Slug): Collaborator[] | undefined {
        return this.collaboratorsMap.get(slug);
    }
}
