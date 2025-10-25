import { AutocompleteInteraction } from "discord.js";
import { championsByName } from "../../services/championService";
import { autocompleteChampionAbility, autocompleteAllAbilities, autocompleteSource, autocompleteSynergyChampions } from "./ability/autocomplete";
import { autocompleteAbility, autocompleteCategory } from "./glossary/autocomplete";

export async function handleAdminAutocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === "champion") {
        if (focused.name === "name") {
            const champions = Array.from(championsByName.values());
            const filtered = champions.filter((champion) =>
            champion.name.toLowerCase().includes(focused.value.toLowerCase())
            );
            await interaction.respond(
            filtered
                .map((champion) => ({
                name: champion.name,
                value: champion.name,
                }))
                .slice(0, 25)
            );
        }
    } else if (group === "ability") {
      if (focused.name === "champion") {
        const champions = Array.from(championsByName.values());
        const filtered = champions.filter((champion) =>
          champion.name.toLowerCase().includes(focused.value.toLowerCase())
        );
        await interaction.respond(
          filtered
            .map((champion) => ({ name: champion.name, value: champion.name }))
            .slice(0, 25)
        );
      } else if (focused.name === "ability") {
        if (subcommand === "remove") {
          await autocompleteChampionAbility(interaction);
        } else {
          await autocompleteAllAbilities(interaction);
        }
      } else if (focused.name === "source") {
        await autocompleteSource(interaction);
      } else if (focused.name === "synergy-champions") {
        await autocompleteSynergyChampions(interaction);
      }
    } else if (group === "attack") {
      if (focused.name === "champion") {
        const champions = Array.from(championsByName.values());
        const filtered = champions.filter((champion) =>
          champion.name.toLowerCase().includes(focused.value.toLowerCase())
        );
        await interaction.respond(
          filtered
            .map((champion) => ({ name: champion.name, value: champion.name }))
            .slice(0, 25)
        );
      }
    } else if (group === "glossary") {
        if (focused.name === "ability") {
            await autocompleteAbility(interaction);
        } else if (focused.name === "category") {
            await autocompleteCategory(interaction);
        }
    }
}
