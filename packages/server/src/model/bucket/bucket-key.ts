import { invariant } from "@banjoanton/utils";

export type ImageId = string;
export type Extension = string;
export type BucketKey = `image/${ImageId}.${Extension}`;

export type BucketKeyObject = {
    id: ImageId;
    mimeType: string;
};

const from = (id: ImageId, mimeType: string): BucketKey => {
    const extension = mimeType.split("/")[1];
    return `image/${id}.${extension}`;
};

const parseString = (key: BucketKey): BucketKeyObject => {
    const [prefix, extension] = key.split(".");
    invariant(prefix, "Could not parse prefix from bucket key");
    invariant(extension, "Could not parse extension from bucket key");

    const [_, id] = prefix.split("-");
    invariant(id, "Could not parse id from bucket key");

    return {
        id,
        mimeType: `image/${extension}`,
    };
};

export const BucketKey = { from, parseString };
