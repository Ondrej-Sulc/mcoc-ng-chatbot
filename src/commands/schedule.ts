import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonInteraction,
} from "discord.js";
import { Command } from "../types/command";
import {
  addSchedule,
  getSchedules,
  deleteSchedule,
  Schedule,
  ScheduleFrequency,
} from "../services/scheduleDbService";
import { registerButtonHandler } from "../utils/buttonHandlerRegistry";
import { startScheduler } from "../services/schedulerService";
import { commands as loadedCommands } from "../utils/commandHandler";
import { handleError, safeReply } from "../utils/errorHandler";

/**
 * Recursively extracts subcommands and subcommand groups from a command's options.
 * @param options - The options to extract subcommands from.
 * @param parent - The parent command name.
 * @param allChoices - The array to store the extracted subcommand choices.
 */
function extractSubcommands(
  options: any[],
  parent: string,
  allChoices: string[]
) {
  for (const opt of options) {
    if (opt.type === 1 && typeof opt.name === "string") {
      allChoices.push(`/${parent} ${opt.name}`);
    } else if (opt.type === 2 && Array.isArray(opt.options)) {
      // Subcommand group
      for (const sub of opt.options) {
        if (sub.type === 1 && typeof sub.name === "string") {
          allChoices.push(`/${parent} ${opt.name} ${sub.name}`);
        }
      }
    }
  }
}

/**
 * Handles the button interaction for removing a schedule.
 * @param interaction - The button interaction object.
 */
export async function handleRemoveScheduleButton(
  interaction: ButtonInteraction
) {
  try {
    const scheduleId = interaction.customId.replace("remove-schedule-", "");
    await deleteSchedule(scheduleId);
    await interaction.reply({
      content: `❌ Schedule removed!`,
      flags: [MessageFlags.Ephemeral],
    });
  } catch (error) {
    const { userMessage, errorId } = handleError(error, {
      location: "button:schedule:remove",
      userId: interaction.user?.id,
    });
    await safeReply(interaction, userMessage, errorId);
  }
}
registerButtonHandler("remove-schedule-", handleRemoveScheduleButton);

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Manage scheduled tasks")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new scheduled task for a command or message")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription(
              "Label for this schedule (e.g., 'Morning Reminder')"
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("frequency")
            .setDescription("Frequency: daily, weekly, monthly, every, custom")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time(s), e.g. 09:00 or 09:00,18:00")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("command")
            .setDescription(
              "Command to run (e.g., /today, /exercise pullup). Leave empty if using 'message'."
            )
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription(
              "Custom message to send (optional, overrides command if provided)"
            )
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("target_channel_id")
            .setDescription("Target channel ID (optional)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("target_user_id")
            .setDescription("Target user ID (optional)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("day")
            .setDescription(
              "Day of week (for weekly) or day of month (for monthly)"
            )
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("interval")
            .setDescription("Interval for 'every' frequency, e.g. 2")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("unit")
            .setDescription("Unit for 'every' frequency: days, weeks")
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("cron_expression")
            .setDescription("Custom cron expression (for custom frequency)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all active scheduled tasks")
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a scheduled task by its ID or list number")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID of the schedule to remove (see /schedule list)")
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName("number")
            .setDescription(
              "List number of the schedule to remove (see /schedule list)"
            )
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const subcommand = interaction.options.getSubcommand(true);
    if (subcommand === "add") {
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
      const unit =
        rawUnit === "days" || rawUnit === "weeks" ? rawUnit : null;
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
          message ? `Message: 

${message}` : `Command: 

${command}`
        }
${day ? `- Day: ${day}
` : ""}${ 
        interval ? `- Interval: ${interval}
` : ""
      }${unit ? `- Unit: ${unit}
` : ""}${ 
        cron_expression ? `- Cron: 

${cron_expression}` : ""
      }${ 
        target_channel_id ? `- Channel: <#${target_channel_id}>
` : ""
      }${target_user_id ? `- User: <@${target_user_id}>
` : ""}`
      );
    } else if (subcommand === "list") {
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
                s.message ? `"${s.message}"` : `

${s.command}`
              } (ID: 

${s.id})
${s.target_channel_id ? ` (<#${s.target_channel_id}>)` : ""}${ 
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
    } else if (subcommand === "remove") {
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
  },
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const value = focusedOption.value.toLowerCase();
    let choices: string[] = [];
    switch (focusedOption.name) {
      case "frequency":
        choices = Object.keys(ScheduleFrequency);
        break;
      case "unit":
        choices = ["days", "weeks"];
        break;
      case "command": {
        // Show all commands and all subcommands together
        const allCommands = Array.from(loadedCommands.values());
        let allChoices: string[] = [];
        for (const cmd of allCommands) {
          allChoices.push(`/${cmd.data.name}`);
          // Use .toJSON().options to get plain option objects with type info
          const options = cmd.data.toJSON().options;
          if (options) {
            extractSubcommands(options, cmd.data.name, allChoices);
          }
        }
        choices = allChoices;
        break;
      }
      case "day":
        choices = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
          ...Array.from({ length: 31 }, (_, i) => `${i + 1}`),
        ];
        break;
      default:
        choices = [];
    }
    const filtered = choices
      .filter((c) => c.toLowerCase().includes(value))
      .slice(0, 25);
    await interaction.respond(filtered.map((c) => ({ name: c, value: c })));
  },
};

