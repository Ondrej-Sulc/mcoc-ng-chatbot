import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";
import { getPlayer } from "../../utils/playerHelper";

export async function handleAllianceJoin(interaction: ChatInputCommandInteraction) {
  const player = await getPlayer(interaction);

  if (!player) {
    // getPlayer already sends a reply
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const alliance = await prisma.alliance.upsert({
    where: { guildId: guild.id },
    update: { name: guild.name },
    create: { guildId: guild.id, name: guild.name },
  });

  await prisma.player.update({
    where: { id: player.id },
    data: { allianceId: alliance.id },
  });

  await safeReply(interaction, `You have successfully joined the **${alliance.name}** alliance.`);
}
