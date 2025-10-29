import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";

export async function handleAqScheduleRemove(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const id = interaction.options.getString("id", true);

  try {
    await prisma.aQSchedule.delete({
      where: { id },
    });
    await safeReply(interaction, "AQ schedule entry removed successfully.");
  } catch (error) {
    await safeReply(interaction, "Failed to remove AQ schedule entry. Make sure the ID is correct.");
  }
}
