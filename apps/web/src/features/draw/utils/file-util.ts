import { ElementUtil } from "@/features/draw/utils/element-util";
import { invariant, wrapAsync } from "@banjoanton/utils";
import { FileId } from "@excalidraw/excalidraw/types/element/types";
import { BinaryFileData } from "@excalidraw/excalidraw/types/types";
import { Result } from "common";
import { ofetch } from "ofetch";

type CreateImageFileProps = {
    id?: string | FileId | number;
    data: string;
    mimeType: string;
};

const createImageFile = (props: CreateImageFileProps) => {
    const { data, mimeType, id = ElementUtil.createElementId() } = props;

    const file: BinaryFileData = {
        id: id.toString() as FileId,
        dataURL: data as any,
        mimeType: mimeType as any,
        created: Date.now(),
    };

    return file;
};

const createImageFiles = (images: CreateImageFileProps[]) =>
    images.map(image => createImageFile(image));

const downloadImage = (data: string, filename: string) => {
    const a = document.createElement("a");
    a.href = data;
    a.download = filename;
    a.click();
    a.remove();
};

const base64toBlob = (b64Data: string, contentType = "", sliceSize = 512) => {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers: number[] = Array.from({ length: slice.length });
        for (let i = 0; i < slice.length; i++) {
            const num = slice.codePointAt(i);
            invariant(num !== undefined, "Could not convert slice to byte numbers");
            byteNumbers[i] = num;
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
};

const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64data = reader.result;
            resolve(base64data as string);
        };
        reader.addEventListener("error", reject);
    });

const dataUrlToBlob = (dataUrl: string, mimeType: string) => {
    const dataString = dataUrl.split(",")[1];

    if (!dataString) {
        return undefined;
    }

    return base64toBlob(dataString, mimeType);
};

const uploadToBucket = async (image: BinaryFileData, url: string) => {
    const blob = dataUrlToBlob(image.dataURL, image.mimeType);

    if (!blob) {
        return Result.error("Could not convert data URL to blob");
    }

    const file = new File([blob], image.id, { type: image.mimeType });

    const [_, uploadError] = await wrapAsync(
        async () =>
            await ofetch(url, {
                method: "PUT",
                body: file,
            })
    );

    if (uploadError) {
        return Result.error(uploadError.message);
    }

    return Result.ok();
};

export const FileUtil = {
    createImageFile,
    createImageFiles,
    downloadImage,
    base64toBlob,
    blobToBase64,
    uploadToBucket,
    dataUrlToBlob,
};
