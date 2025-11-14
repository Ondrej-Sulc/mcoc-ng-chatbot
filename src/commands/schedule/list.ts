import {
  ChatInputCommandInteraction,
  MessageFlags,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { getSchedules, Schedule } from "../../services/scheduleDbService";
import { safeReply } from "../../utils/errorHandler";

export async function handleScheduleList(interaction: ChatInputCommandInteraction) {
    const schedules = await getSchedules();
    if (!schedules.length) {
      await safeReply(interaction, "No active schedules found.");
      return;
    }
    const container = new ContainerBuilder();
    const header = new TextDisplayBuilder().setContent(
      "**Active Schedules:**"
    );
    container.addTextDisplayComponents(header);

    schedules.forEach((s: Schedule, i: number) => {
      const section = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**${i + 1}.** [${s.name}] ${s.frequency} at ${s.time} — ${ 
              s.message
                ? `"${s.message}"`
                : `\n\n${s.command}` 
            } (ID: \n\n${s.id})\n${ 
              s.target_channel_id ? ` (<#${s.target_channel_id}>)` : ""
            }${ 
              s.target_user_id ? ` (<@${s.target_user_id}>)` : ""
            }`
          )
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(`remove-schedule-${s.id}`)
            .setLabel("❌")
            .setStyle(ButtonStyle.Secondary)
        );
      container.addSectionComponents(section);
    });
    await interaction.editReply({
      flags: [MessageFlags.IsComponentsV2],
      components: [container],
    });
}