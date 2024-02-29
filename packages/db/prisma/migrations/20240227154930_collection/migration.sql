/*
  Warnings:

  - You are about to drop the `_SavedDrawings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "_SavedDrawings";

-- CreateTable
CREATE TABLE "_Collection" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_Collection_AB_unique" ON "_Collection"("A", "B");

-- CreateIndex
CREATE INDEX "_Collection_B_index" ON "_Collection"("B");
