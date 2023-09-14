-- CreateTable
CREATE TABLE "DrawingElement" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "elementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "drawingId" INTEGER NOT NULL,

    CONSTRAINT "DrawingElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrawingElement_elementId_key" ON "DrawingElement"("elementId");
