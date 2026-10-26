import { z } from "zod";

/** Image types Excalidraw can show, and the only ones that can be uploaded. */
export const IMAGE_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/x-icon",
    "image/avif",
    "image/jfif",
] as const;

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** Excalidraw file ids, which also end up in bucket keys. */
export const ImageIdSchema = z.string().regex(/^[\w-]{1,128}$/);

export const ImageUploadSchema = z.object({
    imageId: ImageIdSchema,
    mimeType: z.enum(IMAGE_MIME_TYPES),
    /** Bytes. Signed into the upload URL, so the upload must be exactly this size. */
    size: z.number().int().positive().max(MAX_IMAGE_SIZE),
});

export type ImageUpload = z.infer<typeof ImageUploadSchema>;

const isAllowedMimeType = (mimeType: string): mimeType is (typeof IMAGE_MIME_TYPES)[number] =>
    IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number]);

export const ImageUtil = {
    isAllowedMimeType,
};
