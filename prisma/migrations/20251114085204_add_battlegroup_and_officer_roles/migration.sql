-- AlterTable
ALTER TABLE "Alliance" ADD COLUMN     "battlegroup1Role" TEXT,
ADD COLUMN     "battlegroup2Role" TEXT,
ADD COLUMN     "battlegroup3Role" TEXT,
ADD COLUMN     "officerRole" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "battlegroup" INTEGER,
ADD COLUMN     "isOfficer" BOOLEAN NOT NULL DEFAULT false;
