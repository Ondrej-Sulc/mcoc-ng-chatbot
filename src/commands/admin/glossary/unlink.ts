import { CommandInteraction } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";

export async function handleGlossaryUnlink(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting glossary unlink process for ${interaction.user.tag}`);

    try {
        await interaction.deferReply({ ephemeral: true });
        const abilityName = interaction.options.getString("ability", true);
        const categoryName = interaction.options.getString("category", true);

        await interaction.editReply(
            `Unlinking ability '${abilityName}' from category '${categoryName}'...`
        );

        const ability = await prisma.ability.findUnique({
            where: { name: abilityName },
        });

        if (!ability) {
            await interaction.editReply(`Ability **${abilityName}** not found.`);
            return;
        }

        const category = await prisma.abilityCategory.findUnique({
            where: { name: categoryName },
        });

        if (!category) {
            await interaction.editReply(`Category **${categoryName}** not found.`);
            return;
        }

        await prisma.ability.update({
            where: { id: ability.id },
            data: {
                categories: {
                    disconnect: { id: category.id },
                },
            },
        });

        await interaction.editReply(
            `Successfully unlinked ability '${abilityName}' from category '${categoryName}'.`
        );
        logger.info(
            `Successfully unlinked ability ${abilityName} from category ${categoryName}`
        );
    } catch (error) {
        logger.error(error, "An error occurred during glossary unlink");
        await interaction.editReply(
            `An error occurred: ${
                error instanceof Error ? error.message : "Unknown error"
            }`
        );
    }
}
