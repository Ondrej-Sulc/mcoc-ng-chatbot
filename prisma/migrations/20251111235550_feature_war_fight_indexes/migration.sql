/*
  Warnings:

  - A unique constraint covering the columns `[allianceId,season,warNumber]` on the table `War` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[warId,playerId,nodeId]` on the table `WarFight` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "War_allianceId_season_warNumber_key" ON "War"("allianceId", "season", "warNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarFight_warId_playerId_nodeId_key" ON "WarFight"("warId", "playerId", "nodeId");
