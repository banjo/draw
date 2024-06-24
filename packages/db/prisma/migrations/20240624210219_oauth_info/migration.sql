-- AlterTable
ALTER TABLE "OauthAccount" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT;
