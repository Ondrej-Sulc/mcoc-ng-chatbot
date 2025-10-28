
import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../../services/prismaService";
import { safeReply } from "../../../utils/errorHandler";

export async function handleBotAdminAdd(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  const player = await prisma.player.update({
    where: { discordId: user.id },
    data: { isBotAdmin: true },
  });

  await safeReply(
    interaction,
    `✅ **${player.ingameName}** has been added as a bot administrator.`
  );
}

export async function handleBotAdminRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  const player = await prisma.player.update({
    where: { discordId: user.id },
    data: { isBotAdmin: false },
  });

  await safeReply(
    interaction,
    `✅ **${player.ingameName}** has been removed as a bot administrator.`
  );
}
