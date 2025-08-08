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
  paginateChampions,
} from "./utils";
import { SearchCoreParams, ChampionWithRelations } from "../../types/search";

const prisma = new PrismaClient();

async function core(
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string,
  userId: string
): Promise<CommandResult> {
  try {
    // Provide client/guild to emoji resolver via a shared global for this call
    (global as any).__discordClient = interactionClientRef;
    (global as any).__discordGuild = interactionGuildRef;

    const { embed, row } = await generateResponse(
      champions,
      searchCriteria,
      totalChampions,
      currentPage,
      totalPages,
      searchId
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

    if (Object.values(searchCriteria).every((v) => !v)) {
      await interaction.editReply({
        content: "You must provide at least one search criteria.",
      });
      return;
    }

    try {
      const where = await buildSearchWhereClause(searchCriteria);
      const allChampions = await prisma.champion.findMany({
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
      });

      if (allChampions.length === 0) {
        await interaction.editReply({
          content: "No champions found matching your criteria.",
        });
        return;
      }

      const pages = paginateChampions(allChampions, searchCriteria);
      searchCache.set(searchId, { criteria: searchCriteria, pages });
      setTimeout(() => searchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

      // Prepare refs to pass to resolver via global for this invocation scope
      interactionClientRef = interaction.client;
      interactionGuildRef = interaction.guild;

      const result = await core(
        pages[0],
        searchCriteria,
        allChampions.length,
        1,
        pages.length,
        searchId,
        interaction.user.id
      );

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

  const cachedSearch = searchCache.get(searchId);

  if (!cachedSearch) {
    await interaction.update({
      content: "This search has expired. Please run the command again.",
      components: [],
    });
    return;
  }

  const { criteria, pages } = cachedSearch;
  const totalPages = pages.length;

  if (newPage < 1 || newPage > totalPages) {
    await interaction.update({
      content: "Invalid page number.",
      components: [],
    });
    return;
  }

  await interaction.deferUpdate();
  // Make client/guild available to utils during this pagination update
  interactionClientRef = interaction.client;
  interactionGuildRef = interaction.guild;
  const result = await core(
    pages[newPage - 1],
    criteria,
    pages.flat().length,
    newPage,
    totalPages,
    searchId,
    interaction.user.id
  );
  await interaction.editReply(result);
}

registerButtonHandler("search", handleSearchPagination);

// Shared refs to make client/guild available to util during response generation
let interactionClientRef: ChatInputCommandInteraction["client"] | null = null;
let interactionGuildRef: ChatInputCommandInteraction["guild"] | null = null;

export default command;

