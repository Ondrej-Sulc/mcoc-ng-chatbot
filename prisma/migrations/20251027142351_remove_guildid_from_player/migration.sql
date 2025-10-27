/*
  Warnings:

  - You are about to drop the column `guildId` on the `Player` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Player_guildId_idx";

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "guildId";
