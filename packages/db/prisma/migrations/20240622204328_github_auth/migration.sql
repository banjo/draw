/*
  Warnings:

  - A unique constraint covering the columns `[github_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `github_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `github_username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- MANUALLY DISABLED AS IT IS NOT USED ANYMORE
-- AlterTable
-- ALTER TABLE "User" ADD COLUMN     "github_id" INTEGER NOT NULL,
-- ADD COLUMN     "github_username" TEXT NOT NULL;

-- CreateIndex
-- CREATE UNIQUE INDEX "User_github_id_key" ON "User"("github_id");
