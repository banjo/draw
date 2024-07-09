import { invariant } from "@banjoanton/utils";
import { prisma } from "db";
import "dotenv/config";
import { BucketService, FileRepository } from "server";
import { BucketKey } from "server/src/model/bucket/bucket-key";

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

const getFile = (data: string, mimeType: string, id: string) => {
    const dataString = data.split(",")[1];

    invariant(dataString, "Could not get data string from image");

    const blob = base64toBlob(dataString, mimeType);
    const file = new File([blob], id, { type: mimeType });
    return file;
};

const main = async () => {
    // @ts-ignore - migration already done, saved for reference
    const imagesInDb: any = await prisma.image.findMany();
    console.log(`Fetched ${imagesInDb.length} images from database`);

    // @ts-ignore - migration already done, saved for reference
    const imageFiles = imagesInDb.map(image => ({
        imageId: image.imageId,
        mimeType: image.mimeType,
        data: image.data,
        key: BucketKey.from(image.imageId, image.mimeType),
    }));

    console.log("Saving to database");
    const uploadedToBucket = await FileRepository.savePresignedImageFiles(imageFiles);

    if (!uploadedToBucket.success) {
        console.error("Failed to upload images to bucket");
        process.exit(1);
    }

    let idx = 0;
    const total = imageFiles.length;
    for (const image of imageFiles) {
        console.log(`Uploading image ${idx + 1} of ${total}`);
        idx++;
        const file = getFile(image.data, image.mimeType, image.imageId);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log("Adding to bucket");
        const res = await BucketService.addFile(buffer, image.key, image.mimeType);

        if (!res.success) {
            console.error(res.message);
            process.exit(1);
        }
        console.log();
    }

    console.log("DONE!");
    process.exit();
};

main().catch(console.error);
