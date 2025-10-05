/*
  Warnings:

  - A unique constraint covering the columns `[championId,abilityId,type,source]` on the table `ChampionAbilityLink` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."ChampionAbilityLink_championId_abilityId_type_key";

-- CreateIndex
CREATE UNIQUE INDEX "ChampionAbilityLink_championId_abilityId_type_source_key" ON "public"."ChampionAbilityLink"("championId", "abilityId", "type", "source");
