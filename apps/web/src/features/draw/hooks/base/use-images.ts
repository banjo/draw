import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { localImageService } from "@/services/local-image-service";
import { logger } from "@/utils/logger";
import { isDefined, isEmpty, wrapAsync } from "@banjoanton/utils";
import { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElements } from "common";
import { ofetch } from "ofetch";
import { useEffect, useState } from "react";

const fetchImagesFromBucket = async (
    presignedUrlResults: { mimeType: string; imageId: string; presignedUrl: string }[]
) =>
    await Promise.all(
        presignedUrlResults.map(async result => {
            const url = result.presignedUrl;

            const blob = await ofetch(url, {
                method: "GET",
                responseType: "blob",
            });

            return {
                data: await FileUtil.blobToBase64(blob),
                mimeType: result.mimeType,
                id: result.imageId,
            };
        })
    );

type In = {
    elements: ExcalidrawElements;
    slug?: string;
};

const getImagesOnCanvas = (files: BinaryFiles, elements: ExcalidrawElements) =>
    Object.values(files)
        .filter(file => file.mimeType.startsWith("image/"))
        .filter(image =>
            elements?.some(element => {
                if (!ExcalidrawUtil.isImageElement(element)) return false;
                return element.fileId === image.id && element.isDeleted !== true;
            })
        );

export const useImages = ({ elements, slug }: In) => {
    const { excalidrawApi } = useGlobal();
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const { handleError } = useError();
    const utils = trpc.useUtils();

    // clear images on new document
    useEffect(() => {
        setUploadedImages([]);
    }, [slug]);

    const fetchImages = async (ids: string[]) => {
        if (!excalidrawApi) return;

        if (!slug) {
            const localImages = await localImageService.loadImages(ids);

            const imageFileProps = await Promise.all(
                localImages.map(async image => ({
                    data: await FileUtil.blobToBase64(image.blob),
                    mimeType: image.mimeType,
                    id: image.id,
                }))
            );

            const files = FileUtil.createImageFiles(imageFileProps);
            setUploadedImages([...uploadedImages, ...imageFileProps.map(image => image.id)]);
            excalidrawApi.addFiles(files);
            return;
        }

        const [presignedUrlResults, error] = await wrapAsync(
            async () =>
                await utils.client.file.getPresignedUrlsByImageIds.query({
                    imageIds: ids,
                })
        );

        if (error) {
            await handleError(error, { toast: true, errorMessage: "Failed to fetch images" });
            return;
        }

        const imagesFromUrls = await fetchImagesFromBucket(presignedUrlResults);

        setUploadedImages([...uploadedImages, ...imagesFromUrls.map(image => image.id)]);
        const files = FileUtil.createImageFiles(imagesFromUrls);
        excalidrawApi.addFiles(files);
    };

    const uploadImagesToBucket = async (images: BinaryFileData[]) => {
        if (isEmpty(images)) return true;

        const [fileData, error] = await wrapAsync(
            async () =>
                await utils.client.file.saveImagesByPresignedUrl.mutate({
                    images: images.map(image => ({
                        imageId: image.id,
                        mimeType: image.mimeType,
                    })),
                })
        );

        if (error) {
            await handleError(error, { toast: true, errorMessage: "Failed to save images" });
            return false;
        }

        const uploadPromises = images.map(async image => {
            const url = fileData.find(r => r.key.includes(image.id));
            if (!url) return;

            const uploadResult = await FileUtil.uploadToBucket(image, url.presignedUrl);

            if (!uploadResult.success) {
                throw new Error("Failed to upload image to bucket");
            }
        });

        const [_, uploadError] = await wrapAsync(() => Promise.all(uploadPromises));

        if (uploadError) {
            await handleError(uploadError, {
                toast: true,
                errorMessage: "Failed to upload images",
            });
            return false;
        }

        return true;
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

    // get images on load or when new images are added
    useEffect(() => {
        if (!elements || !excalidrawApi) return;

        const images = elements
            .filter(ExcalidrawUtil.isImageElement)
            .filter(element => element.fileId && !element.isDeleted);

        if (images.length === 0) return;

        const currentImages = excalidrawApi.getFiles();
        const alreadyFetchedImages = new Set(Object.values(currentImages).map(image => image.id));

        const imagesToFetch = images.filter(image => !alreadyFetchedImages.has(image.fileId!));
        if (imagesToFetch.length === 0) return;

        fetchImages(imagesToFetch.map(image => image.fileId!));
    }, [excalidrawApi, elements, slug]);

    // save images on change
    useEffect(() => {
        if (!excalidrawApi) return;

        const imagesReferencedOnCanvas = getImagesOnCanvas(excalidrawApi.getFiles(), elements);

        const notUploadedImages = imagesReferencedOnCanvas.filter(
            image => !uploadedImages.includes(image.id)
        );

        const removedImages = uploadedImages.filter(
            id => !imagesReferencedOnCanvas.some(image => image.id === id)
        );

        if (!isEmpty(removedImages)) {
            setUploadedImages(uploadedImages.filter(id => !removedImages.includes(id)));

            if (!slug) {
                localImageService.removeImages(removedImages); // do not await
            }
        }

        if (notUploadedImages.length === 0) return;

        const saveImages = async () => {
            if (!slug) {
                const localImages = notUploadedImages
                    .map(image => {
                        const blob = FileUtil.dataUrlToBlob(image.dataURL, image.mimeType);

                        if (!blob) {
                            logger.error({ id: image.id }, "Could not convert dataURL to blob");
                            return undefined;
                        }

                        return {
                            id: image.id,
                            blob,
                            mimeType: image.mimeType,
                        };
                    })
                    .filter(isDefined);

                await localImageService.saveImages(localImages);

                setUploadedImages([...uploadedImages, ...localImages.map(image => image.id)]);
                return;
            }

            const isUploaded = await uploadImagesToBucket(notUploadedImages);
            if (!isUploaded) return;

            const uploadedImageIds = notUploadedImages.map(image => image.id);

            setUploadedImages([...uploadedImages, ...uploadedImageIds]);
        };

        saveImages();
    }, [excalidrawApi, elements, uploadedImages, slug]);

    return {
        uploadImagesOnCanvas,
    };
};
