/*
  Warnings:

  - A unique constraint covering the columns `[drawingId,elementId]` on the table `DrawingElement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "DrawingElement_elementId_key";

-- CreateIndex
CREATE UNIQUE INDEX "DrawingElement_drawingId_elementId_key" ON "DrawingElement"("drawingId", "elementId");
