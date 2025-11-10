/*
  Warnings:

  - The primary key for the `WarVideo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PrefightChampions` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."_PrefightChampions" DROP CONSTRAINT "_PrefightChampions_B_fkey";

-- AlterTable
ALTER TABLE "public"."WarVideo" DROP CONSTRAINT "WarVideo_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "WarVideo_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "WarVideo_id_seq";

-- AlterTable
ALTER TABLE "public"."_PrefightChampions" DROP CONSTRAINT "_PrefightChampions_AB_pkey",
ALTER COLUMN "B" SET DATA TYPE TEXT,
ADD CONSTRAINT "_PrefightChampions_AB_pkey" PRIMARY KEY ("A", "B");

-- AddForeignKey
ALTER TABLE "public"."_PrefightChampions" ADD CONSTRAINT "_PrefightChampions_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."WarVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
