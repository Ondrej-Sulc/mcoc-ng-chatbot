import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
} from "discord.js";
import { Command } from "../../types/command";
import { prisma } from "../../services/prismaService";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import {
  getAutocompletePrefixAndCurrent,
  ATTACK_PROPERTIES,
  ATTACK_TYPE_KEYWORDS,
  ATTACK_GROUP_KEYWORDS,
  MODIFIER_KEYWORDS,
} from "./queryBuilder";
import { handleGlobalSearch, handleSearchPagination } from "./all";
import { handleRosterSearch, handleRosterSearchPagination } from "./roster";
import { ChampionClass } from "@prisma/client";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for champions using multiple criteria.")
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
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = focusedOption.value;

    const { prefix, search } = getAutocompletePrefixAndCurrent(focusedValue);

    if (focusedOption.name === "abilities") {
      const abilities = await prisma.ability.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
          champions: {
            some: {
              type: "ABILITY",
            },
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        abilities.map((ability) => ({
          name: `${prefix}${ability.name}`,
          value: `${prefix}${ability.name}`,
        }))
      );
    } else if (focusedOption.name === "immunities") {
      const immunities = await prisma.ability.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
          champions: {
            some: {
              type: "IMMUNITY",
            },
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        immunities.map((immunity) => ({
          name: `${prefix}${immunity.name}`,
          value: `${prefix}${immunity.name}`,
        }))
      );
    } else if (focusedOption.name === "tags") {
      let tags;
      if (search) {
        tags = await prisma.tag.findMany({
          where: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          distinct: ["name"],
          take: 25,
          orderBy: { name: "asc" },
        });
      } else {
        tags = await prisma.tag.findMany({
          distinct: ["name"],
          take: 25,
          orderBy: {
            champions: {
              _count: "desc",
            },
          },
        });
      }

      await interaction.respond(
        tags.map((tag) => ({
          name: `${prefix}${tag.name}`,
          value: `${prefix}${tag.name}`,
        }))
      );
    } else if (focusedOption.name === "class") {
      const classes = Object.values(ChampionClass).filter((c) =>
        c.toLowerCase().includes(search.toLowerCase())
      );
      await interaction.respond(
        classes.map((c) => ({ name: `${prefix}${c}`, value: `${prefix}${c}` }))
      );
    } else if (focusedOption.name === "ability-category") {
      const categories = await prisma.abilityCategory.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        categories.map((category) => ({
          name: `${prefix}${category.name}`,
          value: `${prefix}${category.name}`,
        }))
      );
    } else if (focusedOption.name === "attack-type") {
      const searchParts = search.toLowerCase().split(/\s+/);
      const lastWord = searchParts.pop() || "";

      const suggestions = [
        ...MODIFIER_KEYWORDS,
        ...ATTACK_PROPERTIES,
        ...ATTACK_TYPE_KEYWORDS,
        ...ATTACK_GROUP_KEYWORDS,
      ];

      const filtered = suggestions.filter(
        (s) =>
          s.toLowerCase().startsWith(lastWord) &&
          !searchParts.includes(s.toLowerCase())
      );

      const baseQuery = search.substring(0, search.lastIndexOf(lastWord));

      await interaction.respond(
        filtered.map((type) => {
          const newQuery = `${baseQuery}${type}`;
          return {
            name: `${prefix}${newQuery}`,
            value: `${prefix}${newQuery}`,
          };
        })
      );
    }
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