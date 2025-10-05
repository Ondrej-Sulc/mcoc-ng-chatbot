import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
} from "discord.js";
import { Command, CommandResult } from "../../types/command";
import { PrismaClient, ChampionClass } from "@prisma/client";

import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import crypto from "crypto";
import { RosterEntryWithChampionRelations } from "../../types/search";
import {
  buildSearchWhereClause,
  generateResponse,
  getAutocompletePrefixAndCurrent,
  searchCache,
  rosterSearchCache,
  paginateChampions,
  paginateRosterChampions,
  generateRosterResponse,
  ATTACK_PROPERTIES,
  ATTACK_TYPE_KEYWORDS,
  ATTACK_GROUP_KEYWORDS,
  MODIFIER_KEYWORDS,
} from "./utils";
import { SearchCoreParams, ChampionWithRelations } from "../../types/search";

const prisma = new PrismaClient();

async function rosterCore(
    champions: RosterEntryWithChampionRelations[],
    searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
    totalChampions: number,
    currentPage: number,
    totalPages: number,
    searchId: string,
    userId: string
): Promise<CommandResult> {
    (global as any).__discordClient = interactionClientRef;
    (global as any).__discordGuild = interactionGuildRef;

    const { embed, row } = await generateRosterResponse(
        champions,
        searchCriteria,
        totalChampions,
        currentPage,
        totalPages,
        searchId
    );

    return { embeds: [embed], components: row ? [row] : [] };
}

async function core(
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string,
  userId: string
): Promise<CommandResult> {
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
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for champions using multiple criteria.")
    .addSubcommand((subcommand) =>
        subcommand
        .setName('all')
        .setDescription('Search from all champions in the game')
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
        .setName('roster')
        .setDescription('Search from a player roster')
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
            .setName('player')
            .setDescription('The player whose roster to search')
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
          return { name: `${prefix}${newQuery}`, value: `${prefix}${newQuery}` };
        })
      );
    }
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'all') {
        await handleGlobalSearch(interaction);
    } else if (subcommand === 'roster') {
        await handleRosterSearch(interaction);
    }
  },
};

async function handleRosterSearch(interaction: ChatInputCommandInteraction) {
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
        await interaction.editReply({ content: "You must provide at least one search criteria." });
        return;
    }

    const targetUser = interaction.options.getUser('player') || interaction.user;
    const player = await prisma.player.findUnique({ where: { discordId: targetUser.id } });

    if (!player) {
        await interaction.editReply({ content: `Player ${targetUser.username} is not registered.` });
        return;
    }

    const where = await buildSearchWhereClause(searchCriteria);
    const rosterEntries = await prisma.roster.findMany({
        where: {
            playerId: player.id,
            champion: where,
        },
        include: {
            champion: {
                include: {
                    tags: true,
                    abilities: { include: { ability: { include: { categories: true } } } },
                    attacks: { include: { hits: true } },
                },
            },
        },
        orderBy: { champion: { name: "asc" } },
    });

    if (rosterEntries.length === 0) {
        await interaction.editReply({ content: "No champions found in the roster matching your criteria." });
        return;
    }

    const criteriaParts: string[] = [];
    for (const [key, value] of Object.entries(searchCriteria)) {
        if (value) {
            criteriaParts.push(`**${key}:** \`${value}\``);
        }
    }
    const criteriaString = criteriaParts.join('\n');
    const criteriaLength = criteriaString.length;

    interactionClientRef = interaction.client;
    interactionGuildRef = interaction.guild;

    const pages = paginateRosterChampions(rosterEntries, searchCriteria, criteriaLength);
    rosterSearchCache.set(searchId, { criteria: searchCriteria, pages });
    setTimeout(() => rosterSearchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

    const result = await rosterCore(
        pages[0],
        searchCriteria,
        rosterEntries.length,
        1,
        pages.length,
        searchId,
        interaction.user.id
    );

    await interaction.editReply(result);
}

async function handleGlobalSearch(interaction: ChatInputCommandInteraction) {
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

    const criteriaParts: string[] = [];
    for (const [key, value] of Object.entries(searchCriteria)) {
        if (value) {
            criteriaParts.push(`**${key}:** \`${value}\``);
        }
    }
    const criteriaString = criteriaParts.join('\n');
    const criteriaLength = criteriaString.length;

    // Prepare refs to pass to resolver via global for this invocation scope
    interactionClientRef = interaction.client;
    interactionGuildRef = interaction.guild;

    const pages = paginateChampions(allChampions, searchCriteria, criteriaLength);
    searchCache.set(searchId, { criteria: searchCriteria, pages });
    setTimeout(() => searchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

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
}

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
registerButtonHandler("roster_search", handleRosterSearchPagination);

async function handleRosterSearchPagination(interaction: ButtonInteraction) {
    const [_, direction, searchId, currentPageStr] = interaction.customId.split(":");
    const currentPage = parseInt(currentPageStr, 10);
    const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

    const cachedSearch = rosterSearchCache.get(searchId);

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
    interactionClientRef = interaction.client;
    interactionGuildRef = interaction.guild;
    const result = await rosterCore(
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

// Shared refs to make client/guild available to util during response generation
let interactionClientRef: ChatInputCommandInteraction["client"] | null = null;
let interactionGuildRef: ChatInputCommandInteraction["guild"] | null = null;

export default command;

