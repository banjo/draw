-- Remove duplicate rows for the same image first, keeping the oldest, or the index fails
DELETE FROM "BucketFile" a
USING "BucketFile" b
WHERE a."imageId" = b."imageId" AND a."id" > b."id";

-- CreateIndex
CREATE UNIQUE INDEX "BucketFile_imageId_key" ON "BucketFile"("imageId");
