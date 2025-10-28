/*
  Warnings:

  - You are about to drop the column `disabledCommands` on the `Alliance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Alliance" DROP COLUMN "disabledCommands",
ADD COLUMN     "enabledFeatureCommands" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "isBotAdmin" BOOLEAN NOT NULL DEFAULT false;
