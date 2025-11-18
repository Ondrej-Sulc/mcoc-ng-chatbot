/*
  Warnings:

  - A unique constraint covering the columns `[championId,playerName]` on the table `Duel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('ACTIVE', 'SUGGESTED', 'OUTDATED');

-- AlterTable
ALTER TABLE "Duel" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'community_csv',
ADD COLUMN     "status" "DuelStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "submittedByDiscordId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Duel_championId_playerName_key" ON "Duel"("championId", "playerName");
