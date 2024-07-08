-- CreateTable
CREATE TABLE "BucketFile" (
    "id" SERIAL NOT NULL,
    "imageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "BucketFile_pkey" PRIMARY KEY ("id")
);
