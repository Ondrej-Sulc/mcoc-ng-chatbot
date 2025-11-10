-- CreateEnum
CREATE TYPE "public"."WarVideoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "isTrustedUploader" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."WarVideo" ADD COLUMN     "status" "public"."WarVideoStatus" NOT NULL DEFAULT 'PENDING';
