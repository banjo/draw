BEGIN;

SET LOCAL lock_timeout = '10s';

LOCK TABLE "Drawing" IN ACCESS EXCLUSIVE MODE;

-- Refuse to discard legacy elements on databases that still use Drawing.data.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Drawing" WHERE cardinality("data") > 0) THEN
        RAISE EXCEPTION 'Drawing.data still contains legacy elements. Back up and migrate them to DrawingElement before retrying.';
    END IF;
END $$;

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "OauthAccount_userId_idx" ON "OauthAccount"("userId");
CREATE INDEX "Drawing_ownerId_idx" ON "Drawing"("ownerId");

-- Foreign-key validation rejects orphaned rows instead of silently deleting them.
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OauthAccount" ADD CONSTRAINT "OauthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DrawingElement" ADD CONSTRAINT "DrawingElement_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Collection" ADD CONSTRAINT "_Collection_A_fkey" FOREIGN KEY ("A") REFERENCES "Drawing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Collection" ADD CONSTRAINT "_Collection_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Drawing" DROP COLUMN "data";

COMMIT;
