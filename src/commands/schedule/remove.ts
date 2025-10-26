import { ChatInputCommandInteraction } from "discord.js";
import { getSchedules, deleteSchedule } from "../../services/scheduleDbService";
import { startScheduler } from "../../services/schedulerService";
import { safeReply } from "../../utils/errorHandler";

export async function handleScheduleRemove(interaction: ChatInputCommandInteraction) {
    let id = interaction.options.getString("id");
    const number = interaction.options.getInteger("number");
    if (!id && number) {
      const schedules = await getSchedules();
      if (number < 1 || number > schedules.length) {
        await safeReply(
          interaction,
          `❌ Invalid schedule number. Use /schedule list to see numbers.`
        );
        return;
      }
      id = schedules[number - 1].id;
    }
    if (!id) {
      await safeReply(
        interaction,
        `❌ Please provide either an ID or a list number.`
      );
      return;
    }
    await deleteSchedule(id);
    await startScheduler(interaction.client);
    await safeReply(
      interaction,
      `❌ Schedule with ID 

${id} has been removed (set inactive).`
    );
}
