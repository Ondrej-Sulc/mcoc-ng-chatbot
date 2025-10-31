/*
  Warnings:

  - You are about to drop the column `remindersEnabled` on the `AQReminderSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."AQReminderSettings" DROP COLUMN "remindersEnabled",
ADD COLUMN     "finalReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "section1ReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "section2ReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
