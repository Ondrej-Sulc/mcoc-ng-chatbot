import {
  ChatInputCommandInteraction,
  ButtonInteraction,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import crypto from "crypto";
import {
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../types/search";
import { buildSearchWhereClause } from "./queryBuilder";
import { rosterSearchCache } from "./cache";
import { paginateRosterChampions } from "./pagination";
import { rosterCore } from "./searchService";



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
    await interaction.editReply({
      content: "You must provide at least one search criteria.",
    });
    return;
  }

  const targetUser = interaction.options.getUser("player") || interaction.user;
  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({
      content: `Player ${targetUser.username} is not registered.`, 
    });
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
          abilities: {
            include: { ability: { include: { categories: true } } },
          },
          attacks: { include: { hits: true } },
        },
      },
    },
    orderBy: { champion: { name: "asc" } },
  });

  if (rosterEntries.length === 0) {
    await interaction.editReply({
      content: "No champions found in the roster matching your criteria.",
    });
    return;
  }

  const criteriaParts: string[] = [];
  for (const [key, value] of Object.entries(searchCriteria)) {
    if (value) {
      criteriaParts.push(`**${key}:** \`${value}\``);
    }
  }
  const criteriaString = criteriaParts.join("\n");
  const criteriaLength = criteriaString.length;

  const pages = paginateRosterChampions(
    interaction.client,
    rosterEntries,
    searchCriteria,
    criteriaLength
  );
  rosterSearchCache.set(searchId, { criteria: searchCriteria, pages });
  setTimeout(() => rosterSearchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

  const result = await rosterCore(
    interaction.client,
    interaction.guild,
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

async function handleRosterSearchPagination(interaction: ButtonInteraction) {
  const [_, direction, searchId, currentPageStr] = 
    interaction.customId.split(":");
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
  const result = await rosterCore(
    interaction.client,
    interaction.guild,
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

export { handleRosterSearch, handleRosterSearchPagination };
