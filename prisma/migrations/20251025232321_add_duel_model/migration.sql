-- CreateTable
CREATE TABLE "public"."Duel" (
    "id" SERIAL NOT NULL,
    "playerName" TEXT NOT NULL,
    "rank" TEXT,
    "championId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Duel_championId_idx" ON "public"."Duel"("championId");

-- AddForeignKey
ALTER TABLE "public"."Duel" ADD CONSTRAINT "Duel_championId_fkey" FOREIGN KEY ("championId") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
