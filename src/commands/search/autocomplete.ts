import { AutocompleteInteraction } from "discord.js";
import {
  getAutocompletePrefixAndCurrent,
  ATTACK_PROPERTIES,
  ATTACK_TYPE_KEYWORDS,
  ATTACK_GROUP_KEYWORDS,
  MODIFIER_KEYWORDS,
} from "./queryBuilder";
import { ChampionClass } from "@prisma/client";

export async function handleAutocomplete(interaction: AutocompleteInteraction) {
    const { prisma } = await import("../../services/prismaService.js");
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
        abilities.map((ability: { name: string }) => ({
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
        immunities.map((immunity: { name: string }) => ({
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
        tags.map((tag: { name: string }) => ({
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
        categories.map((category: { name: string }) => ({
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
}