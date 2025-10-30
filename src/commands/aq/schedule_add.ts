import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";
import { DateTime } from "luxon";
import { getPlayer } from "../../utils/playerHelper";

export async function handleAqScheduleAdd(interaction: ChatInputCommandInteraction) {
  const battlegroup = interaction.options.getInteger("battlegroup", true);
  const dayOfWeek = interaction.options.getInteger("day_of_week", true);
  const time = interaction.options.getString("time", true);
  const aqDay = interaction.options.getInteger("aq_day", true);
  const channel = interaction.options.getChannel("channel", true);
  const roleId = interaction.options.getString("role", true);

  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const player = await getPlayer(interaction);
  if (!player) {
    // getPlayer already replies
    return;
  }

  const userTimezone = player.timezone || 'UTC';
  const [hour, minute] = time.split(':').map(Number);

  if (isNaN(hour) || isNaN(minute)) {
    await safeReply(interaction, "Invalid time format. Please use HH:mm.");
    return;
  }

  const localTime = DateTime.local().setZone(userTimezone).set({ hour, minute });
  if (!localTime.isValid) {
    await safeReply(interaction, `Invalid time for your timezone (${userTimezone}).`);
    return;
  }

  const utcTime = localTime.toUTC().toFormat('HH:mm');

  const alliance = await prisma.alliance.findUnique({ where: { guildId: interaction.guild.id } });
  if (!alliance) {
    await safeReply(interaction, "This server is not registered as an alliance.");
    return;
  }

  try {
    await prisma.aQSchedule.create({
      data: {
        allianceId: alliance.id,
        battlegroup,
        dayOfWeek,
        time: utcTime,
        aqDay,
        channelId: channel.id,
        roleId,
      },
    });

    await safeReply(interaction, `AQ schedule entry added successfully for **${time} ${userTimezone}** (which is **${utcTime} UTC**).`);
  } catch (error) {
    console.error(error);
    await safeReply(interaction, "Failed to add AQ schedule entry. A schedule for this battlegroup on this day may already exist.");
  }
}