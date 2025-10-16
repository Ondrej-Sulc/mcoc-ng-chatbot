import { CommandInteraction } from "discord.js";
import { AbilityLinkType } from "@prisma/client";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";

export async function handleAbilityRemove(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability remove process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply({ ephemeral: true });
      const championName = interaction.options.getString("champion", true);
      const type = interaction.options.getString(
        "type",
        true
      ) as AbilityLinkType;
      const abilityName = interaction.options.getString("ability", true);
      const source: string | null = interaction.options.getString("source");

      await interaction.editReply(
        `Removing ${type.toLowerCase()} '${abilityName}' from **${championName}** with source '${
          source || "Unknown"
        }'...`
      );

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion) {
        await interaction.editReply(`Champion **${championName}** not found.`);
        return;
      }

      const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
      });
      if (!ability) {
        await interaction.editReply(`Ability '${abilityName}' not found.`);
        return;
      }

      const link = await prisma.championAbilityLink.findFirst({
        where: {
          championId: champion.id,
          abilityId: ability.id,
          type: type,
          source: source,
        },
      });

      if (!link) {
        await interaction.editReply(
          `Could not find ${type.toLowerCase()} '${abilityName}' with source '${
            source || "Unknown"
          }' for **${championName}**.`
        );
        return;
      }

      await prisma.championAbilityLink.delete({ where: { id: link.id } });

      await interaction.editReply(
        `Successfully removed ${type.toLowerCase()} '${abilityName}' from **${championName}**.`
      );
      logger.info(
        `Successfully removed ability ${abilityName} from ${championName}`
      );
    } catch (error) {
      logger.error(error, "An error occurred during champion ability remove");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}
