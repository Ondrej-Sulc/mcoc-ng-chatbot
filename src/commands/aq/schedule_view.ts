import { ChatInputCommandInteraction, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from "discord.js";
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

  const container = new ContainerBuilder();

  if (!alliance || !alliance.aqSchedules || alliance.aqSchedules.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("No AQ schedule found for this alliance."));
    await interaction.editReply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
    return;
  }

  const schedulesByDay: { [key: number]: AQSchedule[] } = {};
  alliance.aqSchedules.forEach(s => {
    if (!schedulesByDay[s.dayOfWeek]) {
      schedulesByDay[s.dayOfWeek] = [];
    }
    schedulesByDay[s.dayOfWeek].push(s);
  });

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# AQ Schedule for ${alliance.name}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

  for (const dayIndex of displayOrder) {
    const daySchedules = schedulesByDay[dayIndex];
    if (daySchedules && daySchedules.length > 0) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${days[dayIndex]}`));
      daySchedules.sort((a, b) => a.battlegroup - b.battlegroup || a.time.localeCompare(b.time));
      const scheduleText = daySchedules
        .map(s => `- **BG${s.battlegroup}**: ${s.time} UTC (AQ Day ${s.aqDay}) in <#${s.channelId}> tagging <@&${s.roleId}>
`)
        .join('');
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(scheduleText));
      container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }
  }

  await interaction.editReply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
}