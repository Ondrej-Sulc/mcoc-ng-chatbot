/*
  Warnings:

  - You are about to drop the `PrestigeLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PrestigeLog" DROP CONSTRAINT "PrestigeLog_playerId_fkey";

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "championPrestige" INTEGER,
ADD COLUMN     "relicPrestige" INTEGER,
ADD COLUMN     "summonerPrestige" INTEGER;

-- DropTable
DROP TABLE "public"."PrestigeLog";
