import { AutocompleteInteraction } from "discord.js";
import { ScheduleFrequency } from "../../services/scheduleDbService";
import { commands as loadedCommands } from "../../utils/commandHandler";

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

export async function handleScheduleAutocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    const value = focusedOption.value.toLowerCase();
    let choices: string[] = [];
    switch (focusedOption.name) {
      case "frequency":
        choices = Object.keys(ScheduleFrequency).filter(f => f !== 'custom');
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
}
