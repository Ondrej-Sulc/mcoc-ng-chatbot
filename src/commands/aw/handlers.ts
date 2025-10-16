import { config } from "../../config";
import { sheetsService } from "../../services/sheetsService";
import { MergedAssignment } from "./types";

export async function getMergedData(
  sheetTabName: string
): Promise<MergedAssignment[]> {
  const assignmentsRange = `'${sheetTabName}'!${config.allianceWar.dataRange}`;
  const tacticsAndPrefightsRange = `'${sheetTabName}'!${config.allianceWar.PreFightTacticDataRange}`;

  const [assignmentsData, tacticsAndPrefightsData] =
    await sheetsService.readSheets(config.MCOC_SHEET_ID, [
      assignmentsRange,
      tacticsAndPrefightsRange,
    ]);

  if (!assignmentsData) return [];

  const mergedData: MergedAssignment[] = [];

  for (let i = 0; i < assignmentsData.length; i++) {
    const assignmentRow = assignmentsData[i];
    if (!assignmentRow) {
      continue;
    }
    const tacticsAndPrefightsRow =
      (tacticsAndPrefightsData && tacticsAndPrefightsData[i]) || [];

    const playerName = (assignmentRow[config.allianceWar.playerCol] || "")
      .trim()
      .toLowerCase();
    const attackerName = (
      assignmentRow[config.allianceWar.attackerCol] || ""
    ).trim();
    const defenderName = (
      assignmentRow[config.allianceWar.defenderCol] || ""
    ).trim();

    if (playerName && attackerName && defenderName) {
      mergedData.push({
        playerName,
        attackerName,
        defenderName,
        node: (assignmentRow[config.allianceWar.nodeCol] || "").trim(),
        prefightPlayer: (
          tacticsAndPrefightsRow[config.allianceWar.PreFightPlayerCol] || ""
        )
          .trim()
          .toLowerCase(),
        prefightChampion: (
          tacticsAndPrefightsRow[config.allianceWar.PreFightChampionCol] || ""
        ).trim(),
        attackTactic: (
          tacticsAndPrefightsRow[config.allianceWar.TacticAttackCol] || ""
        ).trim(),
        defenseTactic: (
          tacticsAndPrefightsRow[config.allianceWar.TacticDefenseCol] || ""
        ).trim(),
      });
    }
  }
  return mergedData;
}

export async function getTeamData(
  sheetTabName: string
): Promise<Map<string, string[]>> {
  const teamRange = `'${sheetTabName}'!${config.allianceWar.teamRange}`;
  const [teamData] = await sheetsService.readSheets(config.MCOC_SHEET_ID, [
    teamRange,
  ]);

  const teamMap = new Map<string, string[]>();
  if (!teamData) {
    return teamMap;
  }

  for (let i = 0; i < teamData.length; i += 4) {
    const playerName = (teamData[i]?.[0] || "").trim().toLowerCase();
    if (playerName) {
      const champions = [
        (teamData[i + 1]?.[0] || "").trim(),
        (teamData[i + 2]?.[0] || "").trim(),
        (teamData[i + 3]?.[0] || "").trim(),
      ].filter((c) => c);
      teamMap.set(playerName, champions);
    }
  }

  return teamMap;
}

export async function getNodesData(
  sheetTabName: string
): Promise<Record<string, string>> {
  const nodesRange = `'${sheetTabName}'!${config.allianceWar.nodesRange}`;
  const [nodesData] = await sheetsService.readSheets(config.MCOC_SHEET_ID, [
    nodesRange,
  ]);

  const nodeLookup: Record<string, string> = {};
  if (nodesData) {
    for (const row of nodesData) {
      const nodeNumber = (row[0] || "").trim();
      if (!nodeNumber) continue;
      const nodeNames = (row[1] || "").split("\n");
      const nodeDescriptions = (row[2] || "").split("\n");
      let detailsContent = "\n**Node Details:**\n";
      let detailsAdded = false;
      for (let i = 0; i < nodeNames.length; i++) {
        const name = (nodeNames[i] || "").trim();
        const desc = (nodeDescriptions[i] || "").trim();
        if (name && desc) {
          detailsContent += `- **${name}**: ${desc}\n`;
          detailsAdded = true;
        }
      }
      if (detailsAdded) {
        nodeLookup[nodeNumber] = detailsContent;
      }
    }
  }
  return nodeLookup;
}
