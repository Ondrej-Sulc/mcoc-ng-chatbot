import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";
import { parseDuration } from "../../utils/time";

export async function handleAqSkip(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const durationString = interaction.options.getString("duration", true);
  const durationMs = parseDuration(durationString);

  if (!durationMs) {
    await safeReply(interaction, "Invalid duration format. Use format like `7d`, `1w`, `24h`.");
    return;
  }

  const skipUntil = new Date(Date.now() + durationMs);

  const alliance = await prisma.alliance.findUnique({ where: { guildId: interaction.guild.id } });
  if (!alliance) {
    await safeReply(interaction, "This server is not registered as an alliance.");
    return;
  }

  await prisma.aQSkip.upsert({
    where: { allianceId: alliance.id },
    update: { skipUntil },
    create: { allianceId: alliance.id, skipUntil },
  });

  await safeReply(interaction, `AQ schedule will be skipped until ${skipUntil.toUTCString()}.`);
}
