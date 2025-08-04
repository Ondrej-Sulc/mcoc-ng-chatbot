import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
} from "discord.js";
import { Command, CommandResult } from "../../types/command";
import { PrismaClient, ChampionClass } from "@prisma/client";
import { handleError, safeReply } from "../../utils/errorHandler";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import crypto from "crypto";
import {
  buildSearchWhereClause,
  generateResponse,
  getAutocompletePrefixAndCurrent,
  searchCache,
  ATTACK_PROPERTIES,
  ATTACK_TYPE_KEYWORDS,
  ATTACK_GROUP_KEYWORDS,
  MODIFIER_KEYWORDS,
  PAGE_SIZE,
} from "./utils";
import { SearchCoreParams } from "../../types/search";

const prisma = new PrismaClient();

async function core(params: SearchCoreParams): Promise<CommandResult> {
  const { page = 1, userId, searchId, ...searchCriteria } = params;

  try {
    if (Object.values(searchCriteria).every((v) => !v)) {
      return { content: "You must provide at least one search criteria." };
    }

    const where = await buildSearchWhereClause(searchCriteria);

    const totalChampions = await prisma.champion.count({ where });

    if (totalChampions === 0) {
      return { content: "No champions found matching your criteria." };
    }

    const champions = await prisma.champion.findMany({
      where,
      include: {
        tags: true,
        abilities: {
          include: {
            ability: { include: { categories: true } },
          },
        },
        attacks: { include: { hits: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    const { embed, row } = await generateResponse(
      champions,
      searchCriteria,
      totalChampions,
      page,
      searchId!
    );

    return { embeds: [embed], components: row ? [row] : [] };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:search:core",
      userId: userId,
    });
    return { content: userMessage };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for champions using multiple criteria.")
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
      const tags = await prisma.tag.findMany({
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
          return { name: `${prefix}${newQuery}`, value: `${prefix}${newQuery}` };
        })
      );
    }
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const searchId = crypto.randomUUID();
    const searchCriteria = {
      abilities: interaction.options.getString("abilities"),
      immunities: interaction.options.getString("immunities"),
      tags: interaction.options.getString("tags"),
      championClass: interaction.options.getString("class"),
      abilityCategory: interaction.options.getString("ability-category"),
      attackType: interaction.options.getString("attack-type"),
    };

    searchCache.set(searchId, searchCriteria);
    setTimeout(() => searchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

    try {
      const result = await core({
        ...searchCriteria,
        userId: interaction.user.id,
        searchId,
      });

      await interaction.editReply(result);
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: "command:search",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};

async function handleSearchPagination(interaction: ButtonInteraction) {
  const [_, direction, searchId, currentPageStr] = interaction.customId.split(":");
  const currentPage = parseInt(currentPageStr, 10);
  const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

  const searchCriteria = searchCache.get(searchId);

  if (!searchCriteria) {
    await interaction.update({
      content: "This search has expired. Please run the command again.",
      components: [],
    });
    return;
  }

  await interaction.deferUpdate();
  const result = await core({
    ...searchCriteria,
    userId: interaction.user.id,
    page: newPage,
    searchId,
  });
  await interaction.editReply(result);
}

registerButtonHandler("search_prev", handleSearchPagination);
registerButtonHandler("search_next", handleSearchPagination);

export default command;
