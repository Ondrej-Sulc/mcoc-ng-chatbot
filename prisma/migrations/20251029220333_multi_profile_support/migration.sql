/*
  Warnings:

  - A unique constraint covering the columns `[discordId,ingameName]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Player_discordId_key";

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Player_discordId_idx" ON "public"."Player"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_discordId_ingameName_key" ON "public"."Player"("discordId", "ingameName");
