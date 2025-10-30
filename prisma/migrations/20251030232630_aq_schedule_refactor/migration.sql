/*
  Warnings:

  - A unique constraint covering the columns `[allianceId,battlegroup,aqDay]` on the table `AQSchedule` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."AQSchedule_allianceId_battlegroup_dayOfWeek_key";

-- AlterTable
ALTER TABLE "public"."Alliance" ADD COLUMN     "createAqThread" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "AQSchedule_allianceId_battlegroup_aqDay_key" ON "public"."AQSchedule"("allianceId", "battlegroup", "aqDay");
