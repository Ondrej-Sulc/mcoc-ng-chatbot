import { ChatInputCommandInteraction } from "discord.js";
import { handleAqScheduleAdd } from "./schedule_add";
import { handleAqScheduleRemove } from "./schedule_remove";
import { handleAqScheduleView } from "./schedule_view";

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
