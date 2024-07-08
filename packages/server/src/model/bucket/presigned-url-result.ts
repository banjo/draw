export type PresignedUrlResult = {
    presignedUrl: string;
    key: string;
};

export const PresignedUrlResult = {
    from: (presignedUrl: string, key: string): PresignedUrlResult => ({
        presignedUrl,
        key,
    }),
};
