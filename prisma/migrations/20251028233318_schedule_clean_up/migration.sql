/*
  Warnings:

  - The values [custom] on the enum `ScheduleFrequency` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cron_expression` on the `Schedule` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ScheduleFrequency_new" AS ENUM ('daily', 'weekly', 'monthly', 'every');
ALTER TABLE "public"."Schedule" ALTER COLUMN "frequency" TYPE "public"."ScheduleFrequency_new" USING ("frequency"::text::"public"."ScheduleFrequency_new");
ALTER TYPE "public"."ScheduleFrequency" RENAME TO "ScheduleFrequency_old";
ALTER TYPE "public"."ScheduleFrequency_new" RENAME TO "ScheduleFrequency";
DROP TYPE "public"."ScheduleFrequency_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Schedule" DROP COLUMN "cron_expression";

-- CreateTable
CREATE TABLE "public"."PrestigeLog" (
    "id" SERIAL NOT NULL,
    "summonerPrestige" INTEGER NOT NULL,
    "championPrestige" INTEGER NOT NULL,
    "relicPrestige" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "PrestigeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrestigeLog_playerId_idx" ON "public"."PrestigeLog"("playerId");

-- AddForeignKey
ALTER TABLE "public"."PrestigeLog" ADD CONSTRAINT "PrestigeLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
