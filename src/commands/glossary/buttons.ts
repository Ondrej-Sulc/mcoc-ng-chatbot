import { ButtonInteraction } from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleCategory } from "./category";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { handleList } from "./list";
import { handleEffect } from "./effect";
import crypto from "crypto";
import { buildSearchWhereClause, parseAndOrConditions } from "../search/queryBuilder";
import { searchCache } from "../search/cache";
import { paginate } from "../search/pagination";
import { core } from "../search/searchService";
import { prisma } from "../../services/prismaService";
import { getChampionDisplayLength } from "../search/views/common";
import { ChampionWithRelations } from "../../types/search";

async function handleCategoryButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const categoryName = interaction.customId.substring("glossary_category_".length);
  const resolveEmoji = createEmojiResolver(interaction.client);
  const result = await handleCategory(categoryName, resolveEmoji);
  await interaction.editReply(result);
}

async function handleListBackButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await handleList(resolveEmoji);
    await interaction.editReply(result);
}

async function handleEffectButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const parts = interaction.customId.split("_");
    const effectName = parts[2];
    const categoryName = parts[3];
    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await handleEffect(effectName, resolveEmoji, categoryName);
    await interaction.editReply(result);
}

async function handleBackToCategoryButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const categoryName = interaction.customId.substring("glossary_back_category_".length);
    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await handleCategory(categoryName, resolveEmoji);
    await interaction.editReply(result);
}

async function handleSearchButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const customIdContent = interaction.customId.substring(
        "glossary_search_".length
    );
    const [searchType, ...effectNameParts] = customIdContent.split("_");
    const effectName = effectNameParts.join("_");

    const searchId = crypto.randomUUID();
    const searchCriteria = {
        abilities: searchType === "ability" ? effectName : null,
        immunities: searchType === "immunity" ? effectName : null,
        tags: null,
        championClass: null,
        abilityCategory: null,
        attackType: null,
    };

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
        await interaction.editReply(
            `No champions found with the effect "${effectName}".`
        );
        return;
    }

    const parsedSearchCriteria = {
        abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map(
            (c) => c.toLowerCase()
        ),
        immunities: parseAndOrConditions(
            searchCriteria.immunities
        ).conditions.map((c) => c.toLowerCase()),
        tags: parseAndOrConditions(searchCriteria.tags).conditions.map((c) =>
            c.toLowerCase()
        ),
        abilityCategory: parseAndOrConditions(
            searchCriteria.abilityCategory
        ).conditions.map((c) => c.toLowerCase()),
        attackType: parseAndOrConditions(searchCriteria.attackType).conditions.map(
            (c) => c.toLowerCase()
        ),
    };

    const pages = paginate(allChampions, (champion) =>
        getChampionDisplayLength(champion, parsedSearchCriteria)
    );
    searchCache.set(searchId, { criteria: searchCriteria, pages });
    setTimeout(() => searchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

    const result = await core(
        interaction.client,
        interaction.guild,
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

async function handleCategorySearchButton(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const categoryName = interaction.customId.substring(
        "glossary_search_category_".length
    );

    const searchId = crypto.randomUUID();
    const searchCriteria = {
        abilities: null,
        immunities: null,
        tags: null,
        championClass: null,
        abilityCategory: categoryName,
        attackType: null,
    };

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
        await interaction.editReply(
            `No champions found in the category "${categoryName}".`
        );
        return;
    }

    const parsedSearchCriteria = {
        abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map(
            (c) => c.toLowerCase()
        ),
        immunities: parseAndOrConditions(
            searchCriteria.immunities
        ).conditions.map((c) => c.toLowerCase()),
        tags: parseAndOrConditions(searchCriteria.tags).conditions.map((c) =>
            c.toLowerCase()
        ),
        abilityCategory: parseAndOrConditions(
            searchCriteria.abilityCategory
        ).conditions.map((c) => c.toLowerCase()),
        attackType: parseAndOrConditions(searchCriteria.attackType).conditions.map(
            (c) => c.toLowerCase()
        ),
    };

    const pages = paginate(allChampions, (champion) =>
        getChampionDisplayLength(champion, parsedSearchCriteria)
    );
    searchCache.set(searchId, { criteria: searchCriteria, pages });
    setTimeout(() => searchCache.delete(searchId), 15 * 60 * 1000); // 15 min expiry

    const result = await core(
        interaction.client,
        interaction.guild,
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

export function registerGlossaryButtons() {
  registerButtonHandler("glossary_category_", handleCategoryButton);
  registerButtonHandler("glossary_list_back", handleListBackButton);
  registerButtonHandler("glossary_effect_", handleEffectButton);
  registerButtonHandler("glossary_back_category_", handleBackToCategoryButton);
  registerButtonHandler("glossary_search_", handleSearchButton);
  registerButtonHandler("glossary_search_category_", handleCategorySearchButton);
}
