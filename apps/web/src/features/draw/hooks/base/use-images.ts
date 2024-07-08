import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawUtil } from "@/features/draw/utils/excalidraw-util";
import { FileUtil } from "@/features/draw/utils/file-util";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { wrapAsync } from "@banjoanton/utils";
import { ExcalidrawElements } from "common";
import { ofetch } from "ofetch";
import { useEffect, useState } from "react";

type In = {
    elements: ExcalidrawElements;
    slug?: string;
};

export const useImages = ({ elements, slug }: In) => {
    const { excalidrawApi } = useGlobal();
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const { handleError } = useError();
    const utils = trpc.useUtils();

    const fetchImages = async (ids: string[]) => {
        if (!excalidrawApi || !slug) return;

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

        const imagesFromUrls = await Promise.all(
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

        setUploadedImages([...uploadedImages, ...imagesFromUrls.map(image => image.id)]);
        const files = FileUtil.createImageFiles(imagesFromUrls);
        excalidrawApi.addFiles(files);
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
        if (!excalidrawApi || !slug) return;

        const files = excalidrawApi.getFiles();
        const images = Object.values(files).filter(file => file.mimeType.startsWith("image/"));
        const imagesReferencedOnCanvas = images.filter(image =>
            elements?.some(element => {
                if (!ExcalidrawUtil.isImageElement(element)) return false;
                return element.fileId === image.id && element.isDeleted !== true;
            })
        );

        const notUploadedImages = imagesReferencedOnCanvas.filter(
            image => !uploadedImages.includes(image.id)
        );

        if (notUploadedImages.length === 0) return;

        const saveImages = async () => {
            const [fileData, error] = await wrapAsync(
                async () =>
                    await utils.client.file.saveImagesByPresignedUrl.mutate({
                        images: notUploadedImages.map(image => ({
                            imageId: image.id,
                            mimeType: image.mimeType,
                        })),
                    })
            );

            if (error) {
                await handleError(error, { toast: true, errorMessage: "Failed to save images" });
                return;
            }

            const uploadPromises = notUploadedImages.map(async image => {
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
                return;
            }

            const uploadedImageIds = notUploadedImages.map(image => image.id);

            setUploadedImages([...uploadedImages, ...uploadedImageIds]);
        };

        saveImages();
    }, [excalidrawApi, elements, uploadedImages, slug]);
};
