import { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../../services/prismaService";
import { AbilityLinkType } from "@prisma/client";

export async function autocompleteChampionAbility(interaction: AutocompleteInteraction) {
    const championName = interaction.options.getString("champion");
    const type = interaction.options.getString("type") as AbilityLinkType;
    const focusedValue = interaction.options.getFocused();

    if (!championName || !type) {
      await interaction.respond([]);
      return;
    }

    const links = await prisma.championAbilityLink.findMany({
      where: {
        champion: { name: championName },
        type: type,
        ability: { name: { contains: focusedValue, mode: "insensitive" } },
      },
      include: {
        ability: true,
      },
      distinct: ["abilityId"],
      take: 25,
    });

    const abilities = links.map((link) => link.ability);
    await interaction.respond(
      abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
}

export async function autocompleteAllAbilities(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const abilities = await prisma.ability.findMany({
      where: { name: { contains: focusedValue, mode: "insensitive" } },
      take: 25,
    });
    await interaction.respond(
      abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
}

export async function autocompleteSource(interaction: AutocompleteInteraction) {
    const championName = interaction.options.getString("champion");
    const type = interaction.options.getString("type") as AbilityLinkType;
    const abilityName = interaction.options.getString("ability");
    const focusedValue = interaction.options.getFocused();

    if (!championName || !abilityName || !type) {
      await interaction.respond([]);
      return;
    }

    const links = await prisma.championAbilityLink.findMany({
      where: {
        champion: { name: championName },
        ability: { name: abilityName },
        type: type,
        source: { contains: focusedValue, mode: "insensitive" },
      },
      distinct: ["source"],
      take: 25,
    });

    const sources = links.map((link) => link.source);
    await interaction.respond(
      sources.map((source) => {
        const sourceValue = source === null ? "<None>" : source;
        return { name: sourceValue, value: sourceValue };
      })
    );
}
