import { _Object } from "@aws-sdk/client-s3";
import { raise } from "@banjoanton/utils";

export type BucketFile = {
    key: string;
    lastModified: Date;
    size: number;
};

const fromAwsContent = (content: _Object): BucketFile => ({
    key: content.Key ?? raise("Key is missing"),
    lastModified: content.LastModified ?? raise("Last modified date is missing"),
    size: content.Size ?? raise("Size is missing"),
});

export const BucketFile = { fromAwsContent };
