-- CreateTable
CREATE TABLE "public"."Player" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "ingameName" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "Player_discordId_key" ON "public"."Player"("discordId");

-- CreateIndex
CREATE INDEX "Player_guildId_idx" ON "public"."Player"("guildId");

-- CreateIndex
CREATE INDEX "PrestigeLog_playerId_idx" ON "public"."PrestigeLog"("playerId");

-- AddForeignKey
ALTER TABLE "public"."PrestigeLog" ADD CONSTRAINT "PrestigeLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
