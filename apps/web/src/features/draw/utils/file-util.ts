import { ElementUtil } from "@/features/draw/utils/element-util";
import { FileId } from "@excalidraw/excalidraw/types/element/types";
import { BinaryFileData } from "@excalidraw/excalidraw/types/types";

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
        created: new Date().getMilliseconds(),
    };

    return file;
};

const createImageFiles = (images: CreateImageFileProps[]) => {
    return images.map(image => createImageFile(image));
};

const downloadImage = (data: string, filename: string) => {
    const a = document.createElement("a");
    a.href = data;
    a.download = filename;
    a.click();
    a.remove();
};

export const FileUtil = { createImageFile, createImageFiles, downloadImage };
