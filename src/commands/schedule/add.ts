import { ChatInputCommandInteraction } from "discord.js";
import { addSchedule, ScheduleFrequency } from "../../services/scheduleDbService";
import { startScheduler } from "../../services/schedulerService";
import { safeReply } from "../../utils/errorHandler";

export async function handleScheduleAdd(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString("name", true);
    const frequency = interaction.options.getString(
      "frequency",
      true
    ) as keyof typeof ScheduleFrequency;
    const time = interaction.options.getString("time", true);
    const command = interaction.options.getString("command") || null;
    const message = interaction.options.getString("message") || null;
    let target_channel_id =
      interaction.options.getString("target_channel_id") || null;
    let target_user_id = 
      interaction.options.getString("target_user_id") || null;
    const day = interaction.options.getString("day") || null;
    const interval = interaction.options.getString("interval") || null;
    const rawUnit = interaction.options.getString("unit");
    const unit = rawUnit === "days" || rawUnit === "weeks" ? rawUnit : null;
    const cron_expression =
      interaction.options.getString("cron_expression") || null;

    // Require at least one of command or message
    if (!command && !message) {
      await safeReply(
        interaction,
        "❌ Please provide either a command or a message to schedule."
      );
      return;
    }

    // Set default target if not provided
    if (!target_channel_id && !target_user_id) {
      if (
        interaction.channel &&
        interaction.channel.isTextBased() &&
        interaction.guildId
      ) {
        target_channel_id = interaction.channelId;
      } else {
        target_user_id = interaction.user.id;
      }
    }

    await addSchedule({
      name,
      frequency,
      time,
      command,
      message,
      target_channel_id,
      target_user_id,
      day,
      interval,
      unit,
      cron_expression,
    });
    await startScheduler(interaction.client);
    await safeReply(
      interaction,
      `✅ Scheduled task:
- Name: **${name}**
- Frequency: **${frequency}**
- Time: **${time}**
- ${ 
        message
          ? `Message: 

${message}`
          : `Command: 

${command}`
      }
${ 
  day
    ? `- Day: ${day}\n`
    : "" 
}${ 
        interval
          ? `- Interval: ${interval}\n`
          : ""
      }${ 
        unit
          ? `- Unit: ${unit}\n`
          : ""
      }${ 
        cron_expression
          ? `- Cron: 

${cron_expression}`
          : ""
      }${ 
        target_channel_id
          ? `- Channel: <#${target_channel_id}>
`
          : ""
      }${ 
        target_user_id
          ? `- User: <@${target_user_id}>
`
          : ""
      }`
    );
}
