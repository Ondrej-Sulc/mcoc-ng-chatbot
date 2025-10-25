import { CommandInteraction } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { championList } from "../../../services/championService";
import Fuse from "fuse.js";

export async function handleDuelUpload(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting duel data upload process for ${interaction.user.tag}`);

    try {
        await interaction.deferReply({ ephemeral: true });

        const attachment = interaction.options.getAttachment("csv", true);
        logger.info(`Attachment content type: ${attachment.contentType}`);
        if (!attachment.contentType?.startsWith("text/csv")) {
            await interaction.editReply("Please upload a valid CSV file.");
            return;
        }

        await interaction.editReply("Processing CSV file...");

        const response = await fetch(attachment.url);
        if (!response.ok) {
            await interaction.editReply(`Failed to fetch the file: ${response.statusText}`);
            return;
        }
        const csvData = await response.text();

        await prisma.duel.deleteMany({});
        logger.info("Cleared existing duel data.");

        const fuse = new Fuse(championList, { keys: ['name'], threshold: 0.2 });

        const rows = csvData.split('\n').slice(1); // Skip header
        let createdCount = 0;

        for (const row of rows) {
            const [championName, duelTargetsStr] = row.split(',');
            if (!championName || !duelTargetsStr) continue;

            const championResults = fuse.search(championName.trim());
            if (championResults.length === 0) {
                logger.warn(`Champion not found: ${championName}`);
                continue;
            }
            const champion = championResults[0].item;

            const duelTargets = duelTargetsStr.split('|').map(s => s.trim());

            for (const target of duelTargets) {
                const rankRegex = /(.*?)(?:\s*\((.*)\))?$/;
                const match = target.match(rankRegex);

                if (match) {
                    const playerName = match[1].trim();
                    const rank = match[2] ? match[2].trim() : null;

                    await prisma.duel.create({
                        data: {
                            championId: champion.id,
                            playerName,
                            rank,
                        },
                    });
                    createdCount++;
                }
            }
        }

        await interaction.editReply(`Successfully uploaded and processed the duel data. Created ${createdCount} duel targets.`);
        logger.info(`Successfully created ${createdCount} duel targets.`);

    } catch (error) {
        logger.error(error, "An error occurred during duel data upload");
        await interaction.editReply(
            `An error occurred: ${ 
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}
