import { ButtonInteraction, MessageFlags } from "discord.js";
import { deleteSchedule } from "../../services/scheduleDbService";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";

/**
 * Handles the button interaction for removing a schedule.
 * @param interaction - The button interaction object.
 */
export async function handleRemoveScheduleButton(
  interaction: ButtonInteraction
) {
  const scheduleId = interaction.customId.replace("remove-schedule-", "");
  await deleteSchedule(scheduleId);
  await interaction.reply({
    content: `❌ Schedule removed!`,
    flags: [MessageFlags.Ephemeral],
  });
}

export function registerScheduleHandlers() {
  registerButtonHandler("remove-schedule-", handleRemoveScheduleButton);
}
