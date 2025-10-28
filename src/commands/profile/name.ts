import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { handleError, safeReply } from "../../utils/errorHandler";

export async function handleName(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const newName = interaction.options.getString("new_name", true);

  try {
    const player = await prisma.player.update({
      where: {
        discordId: interaction.user.id,
      },
      data: {
        ingameName: newName,
      },
    });

    await interaction.editReply({
      content: `Your in-game name has been updated to **${player.ingameName}**.`,
    });
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "profile-name-handler",
      userId: interaction.user.id,
      extra: { newName },
    });
    await safeReply(interaction, userMessage);
  }
}
