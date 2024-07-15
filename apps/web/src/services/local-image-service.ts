const OBJECT_STORE_NAME = "images";
const DB_NAME = "LocalImageDB";

type LocalImage = {
    id: string;
    blob: Blob;
    mimeType: string;
};

class LocalImageSservice {
    private db: IDBDatabase | null = null;

    constructor() {
        this.open();
    }

    private open(): void {
        const request = indexedDB.open(DB_NAME, 1);

        request.addEventListener("upgradeneeded", event => {
            this.db = request.result;
            if (!this.db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                this.db.createObjectStore(OBJECT_STORE_NAME, { keyPath: "id" });
            }
        });

        request.addEventListener("success", event => {
            this.db = request.result;
        });

        request.addEventListener("error", event => {
            console.error("Error opening database:", request.error);
        });
    }

    public saveImage(image: LocalImage): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("Database not initialized.");
                return;
            }

            const transaction = this.db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            const request = store.put(image);

            request.addEventListener("success", () => resolve("Image saved successfully."));
            request.addEventListener("error", () => reject("Error saving image."));
        });
    }

    public saveImages(images: LocalImage[]): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("Database not initialized.");
                return;
            }

            const transaction = this.db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = transaction.objectStore(OBJECT_STORE_NAME);

            images.forEach(image => {
                const request = store.put(image);
                request.addEventListener("error", () => reject("Error saving image."));
            });

            transaction.addEventListener("complete", () => resolve("Images saved successfully."));
        });
    }

    public loadImage(id: string): Promise<LocalImage> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("Database not initialized.");
                return;
            }

            const transaction = this.db.transaction(OBJECT_STORE_NAME, "readonly");
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            const request = store.get(id);

            request.addEventListener("success", () => {
                if (request.result) {
                    const blob = request.result.image;
                    const mimeType = request.result.mimeType;
                    resolve({ id, blob, mimeType });
                } else {
                    reject("Image not found.");
                }
            });
            request.addEventListener("error", () => reject("Error retreiving image."));
        });
    }

    public loadImages(ids: string[]): Promise<LocalImage[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("Database not initialized.");
                return;
            }

            const transaction = this.db.transaction(OBJECT_STORE_NAME, "readonly");
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            const images: LocalImage[] = [];

            ids.forEach(id => {
                const request = store.get(id);
                request.addEventListener("success", () => {
                    if (request.result) {
                        const blob = request.result.blob;
                        const mimeType = request.result.mimeType;
                        images.push({ id, blob, mimeType });
                    }
                });
                request.addEventListener("error", () => reject("Error retreiving image."));
            });

            transaction.addEventListener("complete", () => resolve(images));
        });
    }

    public removeImage(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("Database not initialized.");
                return;
            }

            const transaction = this.db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = transaction.objectStore(OBJECT_STORE_NAME);
            const request = store.delete(id);

            request.addEventListener("success", () => resolve());
            request.addEventListener("error", () => reject("Error removing image."));
        });
    }

    public removeImages(ids: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject("Database not initialized.");
                return;
            }

            const transaction = this.db.transaction(OBJECT_STORE_NAME, "readwrite");
            const store = transaction.objectStore(OBJECT_STORE_NAME);

            ids.forEach(id => {
                const request = store.delete(id);
                request.addEventListener("error", () => reject("Error removing image."));
            });

            transaction.addEventListener("complete", () => resolve());
        });
    }
}

export const localImageService = new LocalImageSservice();
