import { useGlobal } from "@/contexts/global-context";
import { ExcalidrawElements } from "@/features/draw/hooks/base/use-elements-state";
import { useError } from "@/hooks/use-error";
import { trpc } from "@/lib/trpc";
import { wrapAsync } from "@banjoanton/utils";
import { ExcalidrawImageElement } from "@excalidraw/excalidraw/types/element/types";
import { BinaryFileData } from "@excalidraw/excalidraw/types/types";
import { useEffect, useState } from "react";

type In = {
    elements: ExcalidrawElements;
};

export const useImages = ({ elements }: In) => {
    const { excalidrawApi } = useGlobal();
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const { handleError } = useError();
    const utils = trpc.useContext();

    const fetchImages = async (ids: string[]) => {
        if (!excalidrawApi) return;

        const [images, error] = await wrapAsync(
            async () =>
                await utils.client.image.getImages.query({
                    imageIds: ids,
                })
        );

        if (error) {
            await handleError(error, { toast: true, errorMessage: "Failed to fetch images" });
            return;
        }

        const files: BinaryFileData[] = images.map(image => ({
            id: image.imageId as any,
            dataURL: image.data as any,
            mimeType: image.mimeType as any,
            created: new Date().getMilliseconds(),
        }));

        excalidrawApi.addFiles(files);
    };

    // get images on load or when new images are added
    useEffect(() => {
        if (!elements || !excalidrawApi) return;

        const images = elements.filter(
            element => element.type === "image" && !element.isDeleted && element.fileId
        ) as ExcalidrawImageElement[];
        if (images.length === 0) return;

        const currentImages = excalidrawApi.getFiles();
        const alreadyFetchedImages = Object.values(currentImages).map(image => image.id);

        const imagesToFetch = images.filter(image => !alreadyFetchedImages.includes(image.fileId!));
        if (imagesToFetch.length === 0) return;

        fetchImages(imagesToFetch.map(image => image.fileId!));
    }, [excalidrawApi, elements]);

    // save images on change
    useEffect(() => {
        if (!excalidrawApi) return;

        const files = excalidrawApi.getFiles();
        const images = Object.values(files).filter(file => file.mimeType.startsWith("image/"));
        const imagesReferencedOnCanvas = images.filter(
            image =>
                elements?.some(
                    element =>
                        element.type === "image" &&
                        element.fileId === image.id &&
                        element.isDeleted !== true
                )
        );

        const notUploadedImages = imagesReferencedOnCanvas.filter(
            image => !uploadedImages.includes(image.id)
        );

        if (!notUploadedImages.length) return;

        const saveImages = async () => {
            const [res, error] = await wrapAsync(
                async () =>
                    await utils.client.image.saveImages.mutate(
                        notUploadedImages.map(image => ({
                            id: image.id,
                            data: image.dataURL,
                            mimeType: image.mimeType,
                        }))
                    )
            );

            if (error) {
                await handleError(error, { toast: true, errorMessage: "Failed to save images" });
                return;
            }

            setUploadedImages([...uploadedImages, ...notUploadedImages.map(image => image.id)]);
        };

        saveImages();
    }, [excalidrawApi, elements]);
};
