import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";
import { AQSchedule } from "@prisma/client";

export async function handleAqScheduleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
    include: { aqSchedules: true },
  });

  if (!alliance || !alliance.aqSchedules || alliance.aqSchedules.length === 0) {
    await safeReply(interaction, "No AQ schedule found for this alliance.");
    return;
  }

  const schedulesByDay: { [key: number]: AQSchedule[] } = {};
  alliance.aqSchedules.forEach(s => {
    if (!schedulesByDay[s.dayOfWeek]) {
      schedulesByDay[s.dayOfWeek] = [];
    }
    schedulesByDay[s.dayOfWeek].push(s);
  });

  let scheduleText = `# AQ Schedule for ${alliance.name}\n\n`;

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

  for (const dayIndex of displayOrder) {
    const daySchedules = schedulesByDay[dayIndex];
    if (daySchedules && daySchedules.length > 0) {
      scheduleText += `### ${days[dayIndex]}\n`;
      daySchedules.sort((a, b) => a.battlegroup - b.battlegroup || a.time.localeCompare(b.time));
      scheduleText += daySchedules
        .map(s => `- **BG${s.battlegroup}**: ${s.time} UTC (AQ Day ${s.aqDay}) in <#${s.channelId}> tagging <@&${s.roleId}>`)
        .join('\n');
      scheduleText += '\n\n';
    }
  }

  await interaction.editReply({ content: scheduleText });
}
