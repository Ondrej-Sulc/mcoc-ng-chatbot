-- CreateTable
CREATE TABLE "public"."ChampionAbilitySynergy" (
    "id" SERIAL NOT NULL,
    "championAbilityLinkId" INTEGER NOT NULL,
    "championId" INTEGER NOT NULL,

    CONSTRAINT "ChampionAbilitySynergy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChampionAbilitySynergy_championAbilityLinkId_idx" ON "public"."ChampionAbilitySynergy"("championAbilityLinkId");

-- CreateIndex
CREATE INDEX "ChampionAbilitySynergy_championId_idx" ON "public"."ChampionAbilitySynergy"("championId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionAbilitySynergy_championAbilityLinkId_championId_key" ON "public"."ChampionAbilitySynergy"("championAbilityLinkId", "championId");

-- AddForeignKey
ALTER TABLE "public"."ChampionAbilitySynergy" ADD CONSTRAINT "ChampionAbilitySynergy_championAbilityLinkId_fkey" FOREIGN KEY ("championAbilityLinkId") REFERENCES "public"."ChampionAbilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChampionAbilitySynergy" ADD CONSTRAINT "ChampionAbilitySynergy_championId_fkey" FOREIGN KEY ("championId") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
