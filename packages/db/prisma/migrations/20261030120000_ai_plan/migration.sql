-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "AiRequest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "isFix" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRequest_userId_createdAt_idx" ON "AiRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The owner's account
UPDATE "User" SET "plan" = 'pro' WHERE "email" = 'anton.odman@gmail.com';
