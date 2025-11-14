/*
  Warnings:

  - You are about to drop the column `youtubeUrl` on the `WarVideo` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[url]` on the table `WarVideo` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "WarVideo_youtubeUrl_key";

-- AlterTable
ALTER TABLE "WarVideo" DROP COLUMN "youtubeUrl",
ADD COLUMN     "url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WarVideo_url_key" ON "WarVideo"("url");
