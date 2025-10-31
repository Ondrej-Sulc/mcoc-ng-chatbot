/*
  Warnings:

  - You are about to drop the column `finalPingHoursBeforeEnd` on the `AQReminderSettings` table. All the data in the column will be lost.
  - You are about to drop the column `section1PingDelayHours` on the `AQReminderSettings` table. All the data in the column will be lost.
  - You are about to drop the column `section2PingDelayHours` on the `AQReminderSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."AQReminderSettings" DROP COLUMN "finalPingHoursBeforeEnd",
DROP COLUMN "section1PingDelayHours",
DROP COLUMN "section2PingDelayHours",
ADD COLUMN     "finalPingTime" TEXT NOT NULL DEFAULT '11:00',
ADD COLUMN     "section1PingTime" TEXT NOT NULL DEFAULT '11:00',
ADD COLUMN     "section2PingTime" TEXT NOT NULL DEFAULT '18:00';
