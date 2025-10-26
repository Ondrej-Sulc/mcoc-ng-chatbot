import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { importRosterFromSheet } from "../../services/rosterService";
import { safeReply } from "../../utils/errorHandler";

export async function handleProfileRegister(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const ingameName = interaction.options.getString("name", true);
  const discordId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const player = await prisma.player.upsert({
    where: { discordId },
    update: { ingameName, guildId },
    create: { discordId, ingameName, guildId },
  });

  // Import roster from sheet after registration
  await importRosterFromSheet(player.id);

  await safeReply(interaction, `✅ Successfully registered **${player.ingameName}**.`);
}
