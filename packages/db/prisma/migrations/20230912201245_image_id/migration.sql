/*
  Warnings:

  - A unique constraint covering the columns `[imageId]` on the table `Image` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `imageId` to the `Image` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "imageId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Image_imageId_key" ON "Image"("imageId");
