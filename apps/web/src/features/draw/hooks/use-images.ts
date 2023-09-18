import { ExcalidrawElements } from "@/features/draw/hooks/use-elements-state";
import { trpc } from "@/lib/trpc";
import { Maybe } from "@banjoanton/utils";
import { ExcalidrawImageElement } from "@excalidraw/excalidraw/types/element/types";
import { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type In = {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    elements: ExcalidrawElements;
};

export const useImages = ({ excalidrawApi, elements }: In) => {
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);

    const utils = trpc.useContext();

    const fetchImages = async (ids: string[]) => {
        if (!excalidrawApi) return;

        const res = await utils.client.image.getImages.query({
            imageIds: ids,
        });

        if (!res.success) {
            toast.error("Failed to fetch images");
            return;
        }

        const images = res.data;

        const files: BinaryFileData[] = images.map(image => ({
            id: image.imageId as any,
            dataURL: image.data as any,
            mimeType: image.mimeType as any,
            created: new Date().getMilliseconds(),
        }));

        excalidrawApi.addFiles(files);
    };

    // get images on load
    useEffect(() => {
        if (!elements || !excalidrawApi) return;

        const images = elements.filter(
            element => element.type === "image" && !element.isDeleted && element.fileId
        ) as ExcalidrawImageElement[];
        if (images.length === 0) return;

        fetchImages(images.map(image => image.fileId!));
    }, [excalidrawApi]);

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
            const res = await utils.client.image.saveImages.mutate(
                notUploadedImages.map(image => ({
                    id: image.id,
                    data: image.dataURL,
                    mimeType: image.mimeType,
                }))
            );

            if (!res.success) {
                toast.error("Failed to save images");
                return;
            }

            setUploadedImages([...uploadedImages, ...notUploadedImages.map(image => image.id)]);
        };

        saveImages();
    }, [excalidrawApi, elements]);
};
