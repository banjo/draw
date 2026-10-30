-- CreateEnum
CREATE TYPE "LinkAccess" AS ENUM ('edit', 'view', 'private');

-- AlterTable
-- "access" was never read or written, so every drawing keeps working as before: anyone with the
-- link can edit
ALTER TABLE "Drawing" DROP COLUMN "access",
ADD COLUMN     "linkAccess" "LinkAccess" NOT NULL DEFAULT 'edit';

-- DropEnum
DROP TYPE "Access";
