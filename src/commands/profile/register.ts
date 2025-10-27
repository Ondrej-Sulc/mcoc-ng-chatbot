import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { importRosterFromSheet } from "../../services/rosterService";
import { safeReply } from "../../utils/errorHandler";

export async function handleProfileRegister(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const ingameName = interaction.options.getString("name", true);
  const discordId = interaction.user.id;
  const guild = interaction.guild;

  if (!guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  // Find or create the alliance
  const alliance = await prisma.alliance.upsert({
    where: { guildId: guild.id },
    update: { name: guild.name },
    create: { guildId: guild.id, name: guild.name },
  });

  const player = await prisma.player.upsert({
    where: { discordId },
    update: { ingameName, allianceId: alliance.id },
    create: { discordId, ingameName, allianceId: alliance.id },
  });

  // Import roster from sheet after registration
  await importRosterFromSheet(player.id);

  await safeReply(interaction, `✅ Successfully registered **${player.ingameName}**.`);
}
