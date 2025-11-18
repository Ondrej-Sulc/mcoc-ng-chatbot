import { CommandInteraction } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { championList } from "../../../services/championService";
import Fuse from "fuse.js";
import { DuelStatus, DuelSource } from "@prisma/client";

export async function handleDuelUpload(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  logger.info(`Starting duel data upload process for ${interaction.user.tag}`);

  try {
    await interaction.deferReply({ ephemeral: true });

    const source = interaction.options.getString("source", true) as DuelSource;

    const attachment = interaction.options.getAttachment("csv", true);
    if (!attachment.contentType?.startsWith("text/csv")) {
      await interaction.editReply("Please upload a valid CSV file.");
      return;
    }

    await interaction.editReply("Processing CSV file...");

    const response = await fetch(attachment.url);
    if (!response.ok) {
      await interaction.editReply(
        `Failed to fetch the file: ${response.statusText}`
      );
      return;
    }
    const csvData = await response.text();

    // 1. Fetch all archived duels to prevent them from being re-added.
    const archivedDuels = await prisma.duel.findMany({
      where: { status: DuelStatus.ARCHIVED },
      select: { championId: true, playerName: true },
    });
    const archivedSet = new Set(
      archivedDuels.map((d) => `${d.championId}-${d.playerName}`)
    );
    logger.info(`Found ${archivedSet.size} archived duels to ignore.`);

    // 2. Mark all existing CSV-sourced duels as outdated.
    const { count: outdatedCount } = await prisma.duel.updateMany({
      where: { source, status: DuelStatus.ACTIVE },
      data: { status: DuelStatus.OUTDATED },
    });
    logger.info(`Marked ${outdatedCount} existing CSV duels as OUTDATED.`);

    const fuse = new Fuse(championList, { keys: ["name"], threshold: 0.2 });

    const rows = csvData.split("\n").slice(1); // Skip header
    let processedCount = 0;
    let skippedArchivedCount = 0;

    for (const row of rows) {
      const [championName, duelTargetsStr] = row.split(",");
      if (!championName || !duelTargetsStr) continue;

      const championResults = fuse.search(championName.trim());
      if (championResults.length === 0) {
        logger.warn(`Champion not found: ${championName}`);
        continue;
      }
      const champion = championResults[0].item;

      const duelTargets = duelTargetsStr.split("|").map((s) => s.trim());

      for (const target of duelTargets) {
        const rankRegex = /(.*?)(?:\s*\((.*)\))?$/;
        const match = target.match(rankRegex);

        if (match) {
          const playerName = match[1].trim();
          const rank = match[2] ? match[2].trim() : null;

          // 3. Check if the duel is in the archived set.
          const archiveKey = `${champion.id}-${playerName}`;
          if (archivedSet.has(archiveKey)) {
            skippedArchivedCount++;
            continue;
          }

          // 4. Upsert the duel if it's not archived.
          await prisma.duel.upsert({
            where: {
              championId_playerName: {
                championId: champion.id,
                playerName,
              },
            },
            update: {
              rank,
              status: DuelStatus.ACTIVE,
              source,
            },
            create: {
              championId: champion.id,
              playerName,
              rank,
              status: DuelStatus.ACTIVE,
              source,
            },
          });
          processedCount++;
        }
      }
    }

    let summary = `Successfully processed the duel data. ${processedCount} duel targets from the CSV are now active.`;
    if (skippedArchivedCount > 0) {
      summary += `\nSkipped ${skippedArchivedCount} targets that were previously archived.`;
    }

    await interaction.editReply(summary);
    logger.info(
      `Duel upload complete. Processed: ${processedCount}, Skipped (Archived): ${skippedArchivedCount}`
    );
  } catch (error) {
    logger.error(error, "An error occurred during duel data upload");
    await interaction.editReply(
      `An error occurred: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}


