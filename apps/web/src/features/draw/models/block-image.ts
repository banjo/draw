import { FileId } from "@excalidraw/excalidraw/element/types";
import { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

const toBase64 = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(byte => (binary += String.fromCharCode(byte)));
    return btoa(binary);
};

/** An SVG as the image file of a block, like a note or a table, made in every browser */
export const toSvgFile = (svg: string, id: FileId): BinaryFileData => ({
    id,
    mimeType: "image/svg+xml",
    dataURL: `data:image/svg+xml;base64,${toBase64(svg)}` as DataURL,
    created: Date.now(),
});
