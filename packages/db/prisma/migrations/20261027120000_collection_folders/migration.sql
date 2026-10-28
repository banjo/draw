BEGIN;

SET LOCAL lock_timeout = '10s';

LOCK TABLE "_Collection" IN ACCESS EXCLUSIVE MODE;

CREATE TABLE "Folder" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionEntry" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "drawingId" INTEGER NOT NULL,
    "folderId" INTEGER,
    "pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CollectionEntry_pkey" PRIMARY KEY ("userId","drawingId")
);

-- Every saved drawing stays in the collection, unsorted. "A" is the drawing and "B" the user.
INSERT INTO "CollectionEntry" ("userId", "drawingId") SELECT "B", "A" FROM "_Collection";

DROP TABLE "_Collection";

CREATE INDEX "CollectionEntry_drawingId_idx" ON "CollectionEntry"("drawingId");
CREATE INDEX "CollectionEntry_folderId_idx" ON "CollectionEntry"("folderId");
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");

ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
