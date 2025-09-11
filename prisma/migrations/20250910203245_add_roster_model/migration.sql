-- CreateTable
CREATE TABLE "public"."Roster" (
    "id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "isAwakened" BOOLEAN NOT NULL,
    "powerRating" INTEGER,
    "playerId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Roster_playerId_idx" ON "public"."Roster"("playerId");

-- CreateIndex
CREATE INDEX "Roster_championId_idx" ON "public"."Roster"("championId");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_playerId_championId_stars_key" ON "public"."Roster"("playerId", "championId", "stars");

-- AddForeignKey
ALTER TABLE "public"."Roster" ADD CONSTRAINT "Roster_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Roster" ADD CONSTRAINT "Roster_championId_fkey" FOREIGN KEY ("championId") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
