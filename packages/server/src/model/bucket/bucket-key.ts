import mime from "mime-types";

export type ImageId = string;
export type Extension = string;
export type BucketKey = `image/${Extension}/${ImageId}.${Extension}`;

const from = (id: ImageId, mimeType: string): BucketKey => {
    const extension = mime.extension(mimeType) || "jpeg";
    return `image/${extension}/${id}.${extension}`;
};

export const BucketKey = { from };
