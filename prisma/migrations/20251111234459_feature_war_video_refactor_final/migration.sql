/*
  Warnings:

  - The values [PENDING,APPROVED] on the enum `WarVideoStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `attackerId` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `death` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `defenderId` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `nodeId` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `playerId` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `season` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `warNumber` on the `WarVideo` table. All the data in the column will be lost.
  - You are about to drop the column `warTier` on the `WarVideo` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gcsUrl]` on the table `WarVideo` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WarVideoStatus_new" AS ENUM ('PLANNING', 'UPLOADED', 'PUBLISHED', 'REJECTED');
ALTER TABLE "public"."WarVideo" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WarVideo" ALTER COLUMN "status" TYPE "WarVideoStatus_new" USING ("status"::text::"WarVideoStatus_new");
ALTER TYPE "WarVideoStatus" RENAME TO "WarVideoStatus_old";
ALTER TYPE "WarVideoStatus_new" RENAME TO "WarVideoStatus";
DROP TYPE "public"."WarVideoStatus_old";
ALTER TABLE "WarVideo" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
COMMIT;

-- DropForeignKey
ALTER TABLE "WarVideo" DROP CONSTRAINT "WarVideo_attackerId_fkey";

-- DropForeignKey
ALTER TABLE "WarVideo" DROP CONSTRAINT "WarVideo_defenderId_fkey";

-- DropForeignKey
ALTER TABLE "WarVideo" DROP CONSTRAINT "WarVideo_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "WarVideo" DROP CONSTRAINT "WarVideo_playerId_fkey";

-- DropForeignKey
ALTER TABLE "_PrefightChampions" DROP CONSTRAINT "_PrefightChampions_B_fkey";

-- AlterTable
ALTER TABLE "WarVideo" DROP COLUMN "attackerId",
DROP COLUMN "death",
DROP COLUMN "defenderId",
DROP COLUMN "nodeId",
DROP COLUMN "playerId",
DROP COLUMN "season",
DROP COLUMN "warNumber",
DROP COLUMN "warTier",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "gcsUrl" TEXT,
ALTER COLUMN "youtubeUrl" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PLANNING';

-- CreateTable
CREATE TABLE "War" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "warNumber" INTEGER,
    "warTier" INTEGER NOT NULL,
    "enemyAlliance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allianceId" TEXT NOT NULL,

    CONSTRAINT "War_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarFight" (
    "id" TEXT NOT NULL,
    "death" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attackerId" INTEGER NOT NULL,
    "defenderId" INTEGER NOT NULL,
    "nodeId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "warId" TEXT NOT NULL,
    "videoId" TEXT,

    CONSTRAINT "WarFight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fightIds" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "War_allianceId_idx" ON "War"("allianceId");

-- CreateIndex
CREATE INDEX "WarFight_attackerId_idx" ON "WarFight"("attackerId");

-- CreateIndex
CREATE INDEX "WarFight_defenderId_idx" ON "WarFight"("defenderId");

-- CreateIndex
CREATE INDEX "WarFight_nodeId_idx" ON "WarFight"("nodeId");

-- CreateIndex
CREATE INDEX "WarFight_playerId_idx" ON "WarFight"("playerId");

-- CreateIndex
CREATE INDEX "WarFight_warId_idx" ON "WarFight"("warId");

-- CreateIndex
CREATE INDEX "WarFight_videoId_idx" ON "WarFight"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_token_key" ON "UploadSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "WarVideo_gcsUrl_key" ON "WarVideo"("gcsUrl");

-- CreateIndex
CREATE INDEX "WarVideo_submittedById_idx" ON "WarVideo"("submittedById");

-- AddForeignKey
ALTER TABLE "War" ADD CONSTRAINT "War_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "WarNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_warId_fkey" FOREIGN KEY ("warId") REFERENCES "War"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarFight" ADD CONSTRAINT "WarFight_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "WarVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PrefightChampions" ADD CONSTRAINT "_PrefightChampions_B_fkey" FOREIGN KEY ("B") REFERENCES "WarFight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
