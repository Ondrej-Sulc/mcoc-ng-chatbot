import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleGlobalSearch, handleSearchPagination } from "./all";
import { handleRosterSearch, handleRosterSearchPagination } from "./roster";
import { handleAutocomplete } from "./autocomplete";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Powerful search for champions based on various criteria.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("all")
        .setDescription("Search from all champions in the game")
        .addStringOption((option) =>
          option
            .setName("abilities")
            .setDescription("Search by abilities (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("immunities")
            .setDescription("Search by immunities (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("tags")
            .setDescription("Search by tags (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("class")
            .setDescription("Search by class (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("ability-category")
            .setDescription("Search by ability category (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("attack-type")
            .setDescription(
              "Syntax: [all|any] [group] [props...]. e.g. 'all basic energy' or 's1 non-contact'"
            )
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("roster")
        .setDescription("Search from a player roster")
        .addStringOption((option) =>
          option
            .setName("abilities")
            .setDescription("Search by abilities (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("immunities")
            .setDescription("Search by immunities (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("tags")
            .setDescription("Search by tags (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("class")
            .setDescription("Search by class (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("ability-category")
            .setDescription("Search by ability category (use 'and'/'or')")
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("attack-type")
            .setDescription(
              "Syntax: [all|any] [group] [props...]. e.g. 'all basic energy' or 's1 non-contact'"
            )
            .setAutocomplete(true)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to search")
            .setRequired(false)
        )
    ),
  access: CommandAccess.PUBLIC,
  async autocomplete(interaction: AutocompleteInteraction) {
    await handleAutocomplete(interaction);
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "all") {
      await handleGlobalSearch(interaction);
    } else if (subcommand === "roster") {
      await handleRosterSearch(interaction);
    }
  },
};

registerButtonHandler("search", handleSearchPagination);
registerButtonHandler("roster_search", handleRosterSearchPagination);

export default command;