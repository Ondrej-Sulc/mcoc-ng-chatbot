import { CommandInteraction } from "discord.js";
import { AbilityLinkType } from "@prisma/client";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";

export async function handleAbilityAdd(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability add process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply({ ephemeral: true });
      const championName = interaction.options.getString("champion", true);
      const type = interaction.options.getString(
        "type",
        true
      ) as AbilityLinkType;
      const abilityName = interaction.options.getString("ability", true);
      const source = interaction.options.getString("source") ?? null;

      await interaction.editReply(
        `Adding ${type.toLowerCase()} '${abilityName}' to **${championName}** from source '${
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

      const ability = await prisma.ability.upsert({
        where: { name: abilityName },
        update: { name: abilityName },
        create: { name: abilityName, description: "" },
      });

      await prisma.championAbilityLink.create({
        data: {
          championId: champion.id,
          abilityId: ability.id,
          type,
          source,
        },
      });

      await interaction.editReply(
        `Successfully added ${type.toLowerCase()} '${abilityName}' to **${championName}**.`
      );
      logger.info(
        `Successfully added ability ${abilityName} to ${championName}`
      );
    } catch (error) {
      logger.error(error, "An error occurred during champion ability add");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
}
