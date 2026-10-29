import { useGlobal } from "@/contexts/global-context";
import { CustomDataUtil } from "@/features/draw/utils/custom-data-util";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { localImageService } from "@/services/local-image-service";
import { logger } from "@/utils/logger";
import { isDefined, isEmpty, uniq, wrapAsync } from "@banjoanton/utils";
import { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";
import {
    ExcalidrawElement,
    ExcalidrawElements,
    ImageUpload,
    ImageUtil,
    MAX_IMAGE_SIZE,
} from "common";
import { useRef } from "react";
import toast from "react-hot-toast";

// Wait this long before trying a failed image again
const RETRY_DELAY = 30_000;

type In = {
    slug?: string;
};

/**
 * Images that are files, not code blocks or Markdown notes: those are made from their code
 * or Markdown in every browser
 */
const isFileImage = (element: ExcalidrawElement) =>
    ExcalidrawUtil.isImageElement(element) &&
    !CustomDataUtil.isCodeBlockElement(element) &&
    !CustomDataUtil.isMarkdownNote(element);

const getImagesOnCanvas = (files: BinaryFiles, elements: ExcalidrawElements) =>
    Object.values(files)
        .filter(file => file.mimeType.startsWith("image/"))
        .filter(image =>
            elements?.some(element => {
                if (!isFileImage(element) || !ExcalidrawUtil.isImageElement(element)) return false;
                return element.fileId === image.id && element.isDeleted !== true;
            })
        );

const toBlobs = (images: BinaryFileData[]) =>
    images
        .map(image => {
            const blob = FileUtil.dataUrlToBlob(image.dataURL, image.mimeType);

            if (!blob) {
                logger.error({ id: image.id }, "Could not convert dataURL to blob");
                return undefined;
            }

            return { image, blob };
        })
        .filter(isDefined);

const fetchBlob = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not fetch image: ${response.status}`);
    return await response.blob();
};

/**
 * Keeps images in sync: saves new images on the canvas (to the bucket, or to the browser for
 * the offline drawing), and loads the ones the canvas shows but doesn't have yet.
 */
export const useImages = ({ slug }: In) => {
    const { excalidrawApi } = useGlobal();
    const { handleError } = useError();
    const utils = trpc.useUtils();

    // Saved or loaded images, the ones being saved or loaded now, and when an image last failed
    const done = useRef(new Set<string>());
    const busy = useRef(new Set<string>());
    const failedAt = useRef(new Map<string, number>());

    const canTry = (id: string) =>
        !busy.current.has(id) && Date.now() - (failedAt.current.get(id) ?? 0) > RETRY_DELAY;

    /** Run a save or load once per image, and back off when it fails. */
    const track = async (ids: string[], work: () => Promise<string[]>) => {
        ids.forEach(id => busy.current.add(id));
        const succeeded = new Set(await work());

        ids.forEach(id => {
            busy.current.delete(id);
            if (succeeded.has(id)) {
                done.current.add(id);
                failedAt.current.delete(id);
            } else {
                failedAt.current.set(id, Date.now());
            }
        });
    };

    const uploadImagesToBucket = async (images: BinaryFileData[]) => {
        if (isEmpty(images)) return true;

        if (images.some(image => !ImageUtil.isAllowedMimeType(image.mimeType))) {
            toast.error("This type of image can't be shared");
            return false;
        }

        const blobs = toBlobs(images);
        if (blobs.some(({ blob }) => blob.size > MAX_IMAGE_SIZE)) {
            toast.error("Images can be at most 5 MB");
            return false;
        }

        const [urls, error] = await wrapAsync(
            async () =>
                await utils.client.file.saveImagesByPresignedUrl.mutate({
                    images: blobs.map(({ image, blob }) => ({
                        imageId: image.id,
                        // Checked above
                        mimeType: image.mimeType as ImageUpload["mimeType"],
                        size: blob.size,
                    })),
                })
        );

        if (error) {
            await handleError(error, { toast: true, errorMessage: "Failed to save images" });
            return false;
        }

        // Images without a URL are in the bucket already
        const [_, uploadError] = await wrapAsync(() =>
            Promise.all(
                blobs.map(async ({ image, blob }) => {
                    // Keys look like image/<extension>/<id>.<extension>
                    const url = urls.find(result => result.key.includes(`/${image.id}.`));
                    if (!url) return;

                    const response = await fetch(url.presignedUrl, { method: "PUT", body: blob });
                    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
                })
            )
        );

        if (uploadError) {
            await handleError(uploadError, {
                toast: true,
                errorMessage: "Failed to upload images",
            });
            return false;
        }

        return true;
    };

    const saveImagesLocally = async (images: BinaryFileData[]) => {
        const localImages = toBlobs(images).map(({ image, blob }) => ({
            id: image.id,
            blob,
            mimeType: image.mimeType,
        }));

        const [_, error] = await wrapAsync(() => localImageService.saveImages(localImages));
        if (error) {
            logger.error({ error }, "Could not save images in the browser");
            return [];
        }

        return localImages.map(image => image.id);
    };

    /** Load images into Excalidraw, and return the ids that loaded. */
    const loadImages = async (ids: string[]) => {
        if (!excalidrawApi) return [];
        const isFirstTry = ids.some(id => !failedAt.current.has(id));

        const [loaded, error] = await wrapAsync(async () => {
            if (!slug) {
                const localImages = await localImageService.loadImages(ids);
                return await Promise.all(
                    localImages.map(async image => ({
                        data: await FileUtil.blobToBase64(image.blob),
                        mimeType: image.mimeType,
                        id: image.id,
                    }))
                );
            }

            const urls = await utils.client.file.getPresignedUrlsByImageIds.query({
                imageIds: ids,
            });
            const results = await Promise.allSettled(
                urls.map(async ({ presignedUrl, mimeType, imageId }) => ({
                    data: await FileUtil.blobToBase64(await fetchBlob(presignedUrl)),
                    mimeType,
                    id: imageId,
                }))
            );

            return results
                .map(result => (result.status === "fulfilled" ? result.value : undefined))
                .filter(isDefined);
        });

        if (error) {
            await handleError(error, { toast: isFirstTry, errorMessage: "Failed to load images" });
            return [];
        }

        if (loaded.length < ids.length && isFirstTry) {
            toast.error("Some images could not be loaded");
        }

        excalidrawApi.addFiles(FileUtil.createImageFiles(loaded));
        return loaded.map(image => image.id);
    };

    // Images in an offline drawing only exist in this browser, so upload them before it gets a link
    const uploadImagesOnCanvas = async () => {
        if (!excalidrawApi) return false;

        const images = getImagesOnCanvas(
            excalidrawApi.getFiles(),
            excalidrawApi.getSceneElements()
        );
        return await uploadImagesToBucket(images);
    };

    // Load images the canvas shows but doesn't have
    const loadMissingImages = (elements: ExcalidrawElements, files: BinaryFiles) => {
        const missing = uniq(
            elements
                .filter(isFileImage)
                .filter(ExcalidrawUtil.isImageElement)
                .filter(element => element.fileId && !element.isDeleted)
                .map(element => element.fileId as string)
        ).filter(id => !files[id] && canTry(id));

        if (missing.length === 0) return;
        void track(missing, () => loadImages(missing));
    };

    // Save new images on the canvas
    const saveNewImages = (elements: ExcalidrawElements, files: BinaryFiles) => {
        const onCanvas = getImagesOnCanvas(files, elements);
        const onCanvasIds = new Set<string>(onCanvas.map(image => image.id));

        // Offline images taken off the canvas are removed from the browser too
        if (!slug) {
            const removed = [...done.current].filter(id => !onCanvasIds.has(id));
            if (removed.length > 0) {
                removed.forEach(id => done.current.delete(id));
                localImageService
                    .removeImages(removed)
                    .catch(error => logger.error({ error }, "Could not remove images"));
            }
        }

        const toSave = onCanvas.filter(image => !done.current.has(image.id) && canTry(image.id));
        if (toSave.length === 0) return;

        const ids = toSave.map(image => image.id);
        void track(ids, async () => {
            if (!slug) return await saveImagesLocally(toSave);
            return (await uploadImagesToBucket(toSave)) ? ids : [];
        });
    };

    /** Call when the elements changed */
    const onElementsChange = (elements: ExcalidrawElements) => {
        if (!excalidrawApi) return;
        const files = excalidrawApi.getFiles();
        loadMissingImages(elements, files);
        saveNewImages(elements, files);
    };

    return {
        uploadImagesOnCanvas,
        onElementsChange,
    };
};
