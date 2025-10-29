import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";
import { getPlayer } from "../../utils/playerHelper";
import { DateTime } from "luxon";

export async function handleTimezone(interaction: ChatInputCommandInteraction) {
  const timezone = interaction.options.getString("timezone", true);

  if (!DateTime.local().setZone(timezone).isValid) {
    await safeReply(
      interaction,
      "Invalid timezone. Please use a valid IANA timezone name from the list: https://nodatime.org/TimeZones"
    );
    return;
  }

  const player = await getPlayer(interaction);
  if (!player) {
    // getPlayer already replies
    return;
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { timezone },
  });

  await safeReply(interaction, `Your timezone has been set to **${timezone}**.`);
}
