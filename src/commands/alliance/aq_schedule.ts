import { ChatInputCommandInteraction } from "discord.js";
import { handleAqScheduleAdd } from "./aq_schedule_add";
import { handleAqScheduleRemove } from "./aq_schedule_remove";
import { handleAqScheduleView } from "./aq_schedule_view";

export async function handleAqSchedule(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case "add":
      await handleAqScheduleAdd(interaction);
      break;
    case "remove":
      await handleAqScheduleRemove(interaction);
      break;
    case "view":
      await handleAqScheduleView(interaction);
      break;
  }
}
