-- CreateTable
CREATE TABLE "public"."WarNode" (
    "id" SERIAL NOT NULL,
    "nodeNumber" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "WarNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WarVideo" (
    "id" SERIAL NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "season" INTEGER NOT NULL,
    "warTier" INTEGER NOT NULL,
    "death" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attackerId" INTEGER NOT NULL,
    "defenderId" INTEGER NOT NULL,
    "nodeId" INTEGER NOT NULL,
    "playerId" TEXT,
    "submittedById" TEXT NOT NULL,

    CONSTRAINT "WarVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_PrefightChampions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PrefightChampions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarNode_nodeNumber_key" ON "public"."WarNode"("nodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarVideo_youtubeUrl_key" ON "public"."WarVideo"("youtubeUrl");

-- CreateIndex
CREATE INDEX "_PrefightChampions_B_index" ON "public"."_PrefightChampions"("B");

-- AddForeignKey
ALTER TABLE "public"."WarVideo" ADD CONSTRAINT "WarVideo_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "public"."Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarVideo" ADD CONSTRAINT "WarVideo_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "public"."Champion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarVideo" ADD CONSTRAINT "WarVideo_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "public"."WarNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarVideo" ADD CONSTRAINT "WarVideo_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarVideo" ADD CONSTRAINT "WarVideo_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PrefightChampions" ADD CONSTRAINT "_PrefightChampions_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PrefightChampions" ADD CONSTRAINT "_PrefightChampions_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."WarVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
