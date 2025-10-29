
import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../../services/prismaService";
import { safeReply } from "../../../utils/errorHandler";

export async function handleBotAdminAdd(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  // We need to check if the user has any profiles first
  const anyProfile = await prisma.player.findFirst({
    where: { discordId: user.id },
  });

  if (!anyProfile) {
    await safeReply(interaction, `User ${user.username} has no registered profiles.`);
    return;
  }

  await prisma.player.updateMany({
    where: { discordId: user.id },
    data: { isBotAdmin: true },
  });

  await safeReply(
    interaction,
    `✅ **${user.username}**'s profiles have been granted bot administrator privileges.`
  );
}

export async function handleBotAdminRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  const anyProfile = await prisma.player.findFirst({
    where: { discordId: user.id },
  });

  if (!anyProfile) {
    // This is unlikely to happen but good to have
    await safeReply(interaction, `User ${user.username} has no registered profiles.`);
    return;
  }

  await prisma.player.updateMany({
    where: { discordId: user.id },
    data: { isBotAdmin: false },
  });

  await safeReply(
    interaction,
    `✅ Bot administrator privileges have been revoked from all of **${user.username}**'s profiles.`
  );
}
