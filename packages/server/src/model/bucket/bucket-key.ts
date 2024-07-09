import { invariant } from "@banjoanton/utils";
import mime from "mime-types";

export type ImageId = string;
export type Extension = string;
export type BucketKey = `image/${Extension}/${ImageId}.${Extension}`;

export type BucketKeyObject = {
    id: ImageId;
    mimeType: string;
};

const from = (id: ImageId, mimeType: string): BucketKey => {
    const extension = mime.extension(mimeType) || "jpeg";
    return `image/${extension}/${id}.${extension}`;
};

const parseString = (key: BucketKey): BucketKeyObject => {
    const match = key.match(/image\/(.+)\/(.+)\.(.+)/);
    invariant(match, "Could not parse bucket key");

    const [_, extension, id, __] = match;
    invariant(extension, "Could not parse extension from bucket key");
    invariant(id, "Could not parse id from bucket key");
    const mimeType = mime.lookup(extension) || "image/jpeg";

    return {
        id,
        mimeType,
    };
};

export const BucketKey = { from, parseString };
