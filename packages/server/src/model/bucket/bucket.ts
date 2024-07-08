import { Bucket as AwsBucket } from "@aws-sdk/client-s3";
import { raise } from "@banjoanton/utils";

export type Bucket = {
    name: string;
};

const fromAwsBucket = (bucket: AwsBucket): Bucket => ({
    name: bucket.Name ?? raise("Bucket name is missing"),
});

export const Bucket = { fromAwsBucket };
