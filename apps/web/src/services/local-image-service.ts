const OBJECT_STORE_NAME = "images";
const DB_NAME = "LocalImageDB";

type LocalImage = {
    id: string;
    blob: Blob;
    mimeType: string;
};

/** Images of the offline drawing, stored in the browser's IndexedDB. */
class LocalImageService {
    // Every call waits for the database to open, so early calls don't fail
    private db: Promise<IDBDatabase>;

    constructor() {
        this.db = this.open();
    }

    private open(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.addEventListener("upgradeneeded", () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                    db.createObjectStore(OBJECT_STORE_NAME, { keyPath: "id" });
                }
            });

            request.addEventListener("success", () => resolve(request.result));
            request.addEventListener("error", () => reject(request.error));
        });
    }

    private async transaction(mode: "readonly" | "readwrite") {
        const db = await this.db;
        const transaction = db.transaction(OBJECT_STORE_NAME, mode);
        const done = new Promise<void>((resolve, reject) => {
            transaction.addEventListener("complete", () => resolve());
            transaction.addEventListener("error", () => reject(transaction.error));
            transaction.addEventListener("abort", () => reject(transaction.error));
        });

        return { store: transaction.objectStore(OBJECT_STORE_NAME), done };
    }

    public async saveImages(images: LocalImage[]): Promise<void> {
        const { store, done } = await this.transaction("readwrite");
        images.forEach(image => store.put(image));
        await done;
    }

    public async loadImages(ids: string[]): Promise<LocalImage[]> {
        const { store, done } = await this.transaction("readonly");
        const images: LocalImage[] = [];

        ids.forEach(id => {
            const request = store.get(id);
            request.addEventListener("success", () => {
                if (request.result) {
                    const { blob, mimeType } = request.result;
                    images.push({ id, blob, mimeType });
                }
            });
        });

        await done;
        return images;
    }

    public async removeImages(ids: string[]): Promise<void> {
        const { store, done } = await this.transaction("readwrite");
        ids.forEach(id => store.delete(id));
        await done;
    }
}

export const localImageService = new LocalImageService();
