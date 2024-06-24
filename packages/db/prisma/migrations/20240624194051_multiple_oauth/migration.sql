/*
  Warnings:

  - You are about to drop the column `externalId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `github_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `github_username` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_externalId_key";

-- DropIndex
DROP INDEX "User_github_id_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "externalId",
DROP COLUMN "github_id",
DROP COLUMN "github_username";

-- CreateTable
CREATE TABLE "OauthAccount" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,

    CONSTRAINT "OauthAccount_pkey" PRIMARY KEY ("provider","providerUserId")
);
