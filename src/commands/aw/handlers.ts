import { MergedAssignment, WarData } from "./types";

function parseA1(a1: string): { col: number; row: number } | null {
  if (!a1) return null;
  const colLettersMatch = a1.match(/[A-Z]+/);
  const rowDigitsMatch = a1.match(/\d+/);

  if (!colLettersMatch || !rowDigitsMatch) return null;

  const colLetters = colLettersMatch[0];
  const rowDigits = rowDigitsMatch[0];

  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.charCodeAt(i) - "A".charCodeAt(0) + 1);
  }

  return { col: col - 1, row: parseInt(rowDigits, 10) - 1 };
}

export async function getChampionData() {
    const { prisma } = await import("../../services/prismaService.js");
    return prisma.champion.findMany();
}

export async function getNodes() {
    const { prisma } = await import("../../services/prismaService.js");
    return prisma.warNode.findMany();
}

export async function getWarData(
  sheetId: string,
  sheetTabName: string
): Promise<WarData> {
  const { config } = await import("../../config.js");
  const { sheetsService } = await import("../../services/sheetsService.js");
  const warInfoRange = `'${sheetTabName}'!${config.allianceWar.warInfoRange}`;
  const [warInfoData] = await sheetsService.readSheets(sheetId, [warInfoRange]);

  const rangeTopLeftA1 = config.allianceWar.warInfoRange.split(":")[0];
  const rangeStart = parseA1(rangeTopLeftA1);

  const findValue = (label: string): string | undefined => {
    if (!rangeStart) return undefined;

    const cellAddress = (config.allianceWar as any)[`${label}Cell`];
    if (!cellAddress) return undefined;

    const cell = parseA1(cellAddress);
    if (!cell) return undefined;

    const relativeRow = cell.row - rangeStart.row;
    const relativeCol = cell.col - rangeStart.col;

    if (relativeRow < 0 || relativeCol < 0) return undefined;

    return warInfoData?.[relativeRow]?.[relativeCol];
  };

  return {
    season: parseInt(findValue("season") || "0", 10),
    warNumber: parseInt(findValue("warNumber") || "0", 10),
    warTier: parseInt(findValue("warTier") || "0", 10),
    enemyAlliance: findValue("enemyAlliance"),
  };
}

export async function getMergedData(
  sheetId: string,
  sheetTabName: string
): Promise<MergedAssignment[]> {
  const { config } = await import("../../config.js");
  const { sheetsService } = await import("../../services/sheetsService.js");
  const assignmentsRange = `'${sheetTabName}'!${config.allianceWar.dataRange}`;
  const tacticsAndPrefightsRange = `'${sheetTabName}'!${config.allianceWar.PreFightTacticDataRange}`;

  const [assignmentsData, tacticsAndPrefightsData] =
    await sheetsService.readSheets(sheetId, [
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
  sheetId: string,
  sheetTabName: string
): Promise<Map<string, string[]>> {
  const { config } = await import("../../config.js");
  const { sheetsService } = await import("../../services/sheetsService.js");
  const teamRange = `'${sheetTabName}'!${config.allianceWar.teamRange}`;
  const [teamData] = await sheetsService.readSheets(sheetId, [
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
  sheetId: string,
  sheetTabName: string
): Promise<Record<string, string>> {
  const { config } = await import("../../config.js");
  const { sheetsService } = await import("../../services/sheetsService.js");
  const nodesRange = `'${sheetTabName}'!${config.allianceWar.nodesRange}`;
  const [nodesData] = await sheetsService.readSheets(sheetId, [
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
