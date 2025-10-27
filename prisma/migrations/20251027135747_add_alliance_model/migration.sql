-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "allianceId" TEXT;

-- CreateTable
CREATE TABLE "public"."Alliance" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "disabledCommands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alliance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alliance_guildId_key" ON "public"."Alliance"("guildId");

-- CreateIndex
CREATE INDEX "Player_allianceId_idx" ON "public"."Player"("allianceId");

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "public"."Alliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
