/*
  Warnings:

  - You are about to drop the column `public` on the `Drawing` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Drawing` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Access" AS ENUM ('public', 'private', 'restricted');

-- AlterTable
ALTER TABLE "Drawing" DROP COLUMN "public",
DROP COLUMN "userId",
ADD COLUMN     "access" "Access" NOT NULL DEFAULT 'public',
ADD COLUMN     "ownerId" INTEGER;

-- CreateTable
CREATE TABLE "_SavedDrawings" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_SavedDrawings_AB_unique" ON "_SavedDrawings"("A", "B");

-- CreateIndex
CREATE INDEX "_SavedDrawings_B_index" ON "_SavedDrawings"("B");
