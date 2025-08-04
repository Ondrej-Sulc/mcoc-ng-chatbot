import {
  Prisma,
  PrismaClient,
  ChampionClass,
  AttackType as AttackTypeEnum,
} from "@prisma/client";
import { SearchCoreParams, ChampionWithRelations } from "../../types/search";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const prisma = new PrismaClient();

export const CLASS_EMOJIS: Record<ChampionClass, string> = {
  MYSTIC: "<:Mystic:1253449751555215504>",
  MUTANT: "<:Mutant:1253449731284406332>",
  SKILL: "<:Skill:1253449798825279660>",
  SCIENCE: "<:Science:1253449774271696967>",
  COSMIC: "<:Cosmic:1253449702595235950>",
  TECH: "<:Tech:1253449817808703519>",
  SUPERIOR: "<:Superior:1253458213618323660>",
};

export const ATTACK_PROPERTIES = [
  "Contact",
  "Projectile",
  "Physical",
  "Energy",
  "Non-Contact",
];
export const ATTACK_TYPE_KEYWORDS = Object.values(AttackTypeEnum);
export const ATTACK_GROUP_KEYWORDS = ["basic", "special"];
export const MODIFIER_KEYWORDS = ["all", "any"];
const EMBED_DESCRIPTION_LIMIT = 4096;
const PER_CHAMPION_BASE_LENGTH = 50; // Base length for "emoji **Name**\n"
const HEADER_FOOTER_BUFFER = 200; // Buffer for title, footer, etc.

export type SearchCacheEntry = {
  criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">;
  pages: ChampionWithRelations[][];
};
export const searchCache = new Map<string, SearchCacheEntry>();

export function parseAndOrConditions(input: string | null | undefined): {
  conditions: string[];
  useAnd: boolean;
} {
  if (!input) {
    return { conditions: [], useAnd: true };
  }
  const lowercasedInput = input.toLowerCase();
  if (lowercasedInput.includes(" or ")) {
    return {
      conditions: input
        .split(/\s+or\s+/i)
        .map((c) => c.trim())
        .filter(Boolean),
      useAnd: false,
    };
  }
  return {
    conditions: input
      .split(/\s+and\s+/i)
      .map((c) => c.trim())
      .filter(Boolean),
    useAnd: true,
  };
}

export function getAutocompletePrefixAndCurrent(current: string): {
  prefix: string;
  search: string;
} {
  let prefix = "";
  let search = current;
  const lastAnd = current.toLowerCase().lastIndexOf(" and ");
  const lastOr = current.toLowerCase().lastIndexOf(" or ");

  if (lastAnd > lastOr) {
    prefix = current.substring(0, lastAnd + 5);
    search = current.substring(lastAnd + 5);
  } else if (lastOr > lastAnd) {
    prefix = current.substring(0, lastOr + 4);
    search = current.substring(lastOr + 4);
  }
  return { prefix, search };
}

export async function buildSearchWhereClause(
  params: Omit<SearchCoreParams, "userId" | "page" | "searchId">
): Promise<Prisma.ChampionWhereInput> {
  const where: Prisma.ChampionWhereInput = { AND: [] };
  const { abilities, immunities, tags, championClass, abilityCategory, attackType } = 
    params;

  if (championClass) {
    const { conditions, useAnd } = parseAndOrConditions(championClass);
    const classEnums = conditions
      .map((c) => c.toUpperCase())
      .filter((c) =>
        Object.keys(ChampionClass).includes(c)
      ) as ChampionClass[];

    if (classEnums.length > 0) {
      if (useAnd) {
        classEnums.forEach((c) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({ class: c });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          class: { in: classEnums },
        });
      }
    }
  }

  if (tags) {
    const { conditions, useAnd } = parseAndOrConditions(tags);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((tagName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            tags: {
              some: { name: { equals: tagName, mode: "insensitive" } },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          tags: {
            some: { name: { in: conditions, mode: "insensitive" } },
          },
        });
      }
    }
  }

  if (abilities) {
    const { conditions, useAnd } = parseAndOrConditions(abilities);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((abilityName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "ABILITY",
                ability: {
                  name: { equals: abilityName, mode: "insensitive" },
                },
              },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          abilities: {
            some: {
              type: "ABILITY",
              ability: { name: { in: conditions, mode: "insensitive" } },
            },
          },
        });
      }
    }
  }

  if (immunities) {
    const { conditions, useAnd } = parseAndOrConditions(immunities);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((immunityName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "IMMUNITY",
                ability: {
                  name: { equals: immunityName, mode: "insensitive" },
                },
              },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          abilities: {
            some: {
              type: "IMMUNITY",
              ability: { name: { in: conditions, mode: "insensitive" } },
            },
          },
        });
      }
    }
  }

  if (abilityCategory) {
    const { conditions, useAnd } = parseAndOrConditions(abilityCategory);
    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((categoryName) => {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                ability: {
                  categories: {
                    some: {
                      name: {
                        equals: categoryName,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          });
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          abilities: {
            some: {
              ability: {
                categories: {
                  some: {
                    name: {
                      in: conditions,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  if (attackType) {
    const { conditions, useAnd } = parseAndOrConditions(attackType);

    const createAttackCondition = (
      condition: string
    ): Prisma.ChampionWhereInput => {
      const parts = condition.toLowerCase().split(/\s+/).filter(Boolean);
      let attackTypes: AttackTypeEnum[] = [];
      const properties: Prisma.HitWhereInput[] = [];
      let modifier: "all" | "any" = "any";

      for (const part of parts) {
        if (part === "all" || part === "any") {
          modifier = part;
          break;
        }
      }

      parts.forEach((part) => {
        if (ATTACK_TYPE_KEYWORDS.includes(part.toUpperCase() as any)) {
          attackTypes.push(part.toUpperCase() as AttackTypeEnum);
        } else if (part === "basic") {
          attackTypes.push(...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[]));
        } else if (part === "special") {
          attackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
        } else if (part === "non-contact") {
          properties.push({
            AND: [
              { properties: { isEmpty: false } },
              { NOT: { properties: { has: "Contact" } } },
            ],
          });
        } else if (part !== "all" && part !== "any") {
          const normalizedProp =
            part.charAt(0).toUpperCase() + part.slice(1);
          if (ATTACK_PROPERTIES.includes(normalizedProp)) {
            properties.push({ properties: { has: normalizedProp } });
          }
        }
      });

      const hitCondition: Prisma.HitWhereInput = { AND: properties };

      const attackWhere: Prisma.AttackWhereInput = {};
      if (attackTypes.length > 0) {
        attackWhere.type = { in: attackTypes };
      }
      if (properties.length > 0) {
        attackWhere.hits = { some: hitCondition };
      }

      if (modifier === "all" && attackTypes.length > 0) {
        return {
          AND: [
            {
              attacks: {
                every: {
                  OR: [
                    { NOT: { type: { in: attackTypes } } },
                    { hits: { some: hitCondition } },
                  ],
                },
              },
            },
            { attacks: { some: { type: { in: attackTypes } } } },
          ],
        };
      } else {
        return { attacks: { some: attackWhere } };
      }
    };

    if (conditions.length > 0) {
      if (useAnd) {
        conditions.forEach((condition) => {
          (where.AND as Prisma.ChampionWhereInput[]).push(
            createAttackCondition(condition)
          );
        });
      } else {
        (where.AND as Prisma.ChampionWhereInput[]).push({
          OR: conditions.map(createAttackCondition),
        });
      }
    }
  }

  return where;
}

export async function generateResponse(
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string
): Promise<{ embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> | null }> {
  const descriptionLines: string[] = [];
  const parsedSearchCriteria = {
    abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map((c) =>
      c.toLowerCase()
    ),
    immunities: parseAndOrConditions(searchCriteria.immunities).conditions.map((c) =>
      c.toLowerCase()
    ),
    tags: parseAndOrConditions(searchCriteria.tags).conditions.map((c) =>
      c.toLowerCase()
    ),
    abilityCategory: parseAndOrConditions(
      searchCriteria.abilityCategory
    ).conditions.map((c) => c.toLowerCase()),
    attackType: parseAndOrConditions(searchCriteria.attackType).conditions.map((c) =>
      c.toLowerCase()
    ),
  };

  for (const champion of champions) {
    const classEmoji = CLASS_EMOJIS[champion.class] || "";
    let champString = `${champion.discordEmoji} **${champion.name}** ${classEmoji}`;

    const matchedAbilities = champion.abilities
      .filter(
        (link) =>
          link.type === "ABILITY" &&
          parsedSearchCriteria.abilities.includes(link.ability.name.toLowerCase())
      )
      .map((link) => link.ability.name);
    if (matchedAbilities.length > 0) {
      champString += `\n> Abilities: *${matchedAbilities.join(", ")}*`;
    }

    const matchedImmunities = champion.abilities
      .filter(
        (link) =>
          link.type === "IMMUNITY" &&
          parsedSearchCriteria.immunities.includes(link.ability.name.toLowerCase())
      )
      .map((link) => link.ability.name);
    if (matchedImmunities.length > 0) {
      champString += `\n> Immunities: *${matchedImmunities.join(", ")}*`;
    }

    const matchedTags = champion.tags
      .filter((tag) => parsedSearchCriteria.tags.includes(tag.name.toLowerCase()))
      .map((tag) => tag.name);
    if (matchedTags.length > 0) {
      champString += `\n> Tags: *${matchedTags.join(", ")}*`;
    }

    if (parsedSearchCriteria.abilityCategory.length > 0) {
      const matchedAbilitiesForCategory = champion.abilities.filter((link) =>
        link.ability.categories.some((cat) =>
          parsedSearchCriteria.abilityCategory.includes(cat.name.toLowerCase())
        )
      );

      if (matchedAbilitiesForCategory.length > 0) {
        const displayCategories = [
          ...new Set(
            matchedAbilitiesForCategory.flatMap((link) =>
              link.ability.categories
                .filter((cat) =>
                  parsedSearchCriteria.abilityCategory.includes(
                    cat.name.toLowerCase()
                  )
                )
                .map((cat) => cat.name)
            )
          ),
        ];

        const displayAbilities = [
          ...new Set(
            matchedAbilitiesForCategory.map((link) => link.ability.name)
          ),
        ];

        if (displayCategories.length > 0) {
          champString += `\n> Categories: *${displayCategories.join(", ")}*`;
          champString += `\n> Matching Abilities: *${displayAbilities.join(", ")}*`;
        }
      }
    }

    if (parsedSearchCriteria.attackType.length > 0) {
      const matchedAttacksOutput = new Set<string>();

      parsedSearchCriteria.attackType.forEach((criteria) => {
        const parts = criteria.toLowerCase().split(/\s+/).filter(Boolean);
        const searchAttackTypes: AttackTypeEnum[] = [];
        const searchProperties: string[] = [];

        parts.forEach((part) => {
          if (ATTACK_TYPE_KEYWORDS.includes(part.toUpperCase() as any)) {
            searchAttackTypes.push(part.toUpperCase() as AttackTypeEnum);
          } else if (part === "basic") {
            searchAttackTypes.push(...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[]));
          } else if (part === "special") {
            searchAttackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
          } else if (!MODIFIER_KEYWORDS.includes(part)) {
            searchProperties.push(part);
          }
        });

        champion.attacks.forEach((attack) => {
          const attackTypeMatch =
            searchAttackTypes.length === 0 ||
            searchAttackTypes.includes(attack.type);

          if (attackTypeMatch) {
            const hasAllProperties = searchProperties.every((prop) => {
              if (prop === "non-contact") {
                return attack.hits.some(
                  (h) =>
                    !h.properties.includes("Contact") && h.properties.length > 0
                );
              } else {
                return attack.hits.some((h) =>
                  h.properties.some((p) => p.toLowerCase() === prop)
                );
              }
            });

            if (hasAllProperties) {
              const props =
                attack.hits.flatMap((h) => h.properties).join(", ") ||
                "No Properties";
              matchedAttacksOutput.add(`${attack.type} (${props})`);
            }
          }
        });
      });

      if (matchedAttacksOutput.size > 0) {
        champString += `\n> Matched Attacks: *${[...matchedAttacksOutput].join(
          "; "
        )}*`;
      }
    }

    descriptionLines.push(champString);
  }

  const fullDescription = `Found **${totalChampions}** champion(s) matching your criteria.\n\n${descriptionLines.join(
    "\n\n"
  )}`;

  const embed = new EmbedBuilder()
    .setTitle("Champion Search Results")
    .setDescription(fullDescription)
    .setColor("Gold");

  let row: ActionRowBuilder<ButtonBuilder> | null = null;
  if (totalChampions > champions.length) {
    embed.setFooter({ text: `Page ${currentPage} of ${totalPages}` });

    row = new ActionRowBuilder<ButtonBuilder>();
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`search:prev:${searchId}:${currentPage}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`search:next:${searchId}:${currentPage}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages)
    );
  }

  return { embed, row };
}

export function paginateChampions(
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">
): ChampionWithRelations[][] {
  const pages: ChampionWithRelations[][] = [];
  let currentPage: ChampionWithRelations[] = [];
  let currentLength = 0;

  const parsedSearchCriteria = {
    abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map((c) =>
      c.toLowerCase()
    ),
    immunities: parseAndOrConditions(searchCriteria.immunities).conditions.map((c) =>
      c.toLowerCase()
    ),
    tags: parseAndOrConditions(searchCriteria.tags).conditions.map((c) =>
      c.toLowerCase()
    ),
    abilityCategory: parseAndOrConditions(
      searchCriteria.abilityCategory
    ).conditions.map((c) => c.toLowerCase()),
    attackType: parseAndOrConditions(searchCriteria.attackType).conditions.map((c) =>
      c.toLowerCase()
    ),
  };

  const getChampionStringLength = (champion: ChampionWithRelations): number => {
    let length = PER_CHAMPION_BASE_LENGTH + champion.name.length;

    const matchedAbilities = champion.abilities
      .filter(
        (link) =>
          link.type === "ABILITY" &&
          parsedSearchCriteria.abilities.includes(link.ability.name.toLowerCase())
      )
      .map((link) => link.ability.name);
    if (matchedAbilities.length > 0) {
      length += `
> Abilities: *${matchedAbilities.join(", ")}*`.length;
    }

    const matchedImmunities = champion.abilities
      .filter(
        (link) =>
          link.type === "IMMUNITY" &&
          parsedSearchCriteria.immunities.includes(link.ability.name.toLowerCase())
      )
      .map((link) => link.ability.name);
    if (matchedImmunities.length > 0) {
      length += `
> Immunities: *${matchedImmunities.join(", ")}*`.length;
    }

    const matchedTags = champion.tags
      .filter((tag) => parsedSearchCriteria.tags.includes(tag.name.toLowerCase()))
      .map((tag) => tag.name);
    if (matchedTags.length > 0) {
      length += `
> Tags: *${matchedTags.join(", ")}*`.length;
    }

    if (parsedSearchCriteria.abilityCategory.length > 0) {
      const matchedAbilitiesForCategory = champion.abilities.filter((link) =>
        link.ability.categories.some((cat) =>
          parsedSearchCriteria.abilityCategory.includes(cat.name.toLowerCase())
        )
      );

      if (matchedAbilitiesForCategory.length > 0) {
        const displayCategories = [
          ...new Set(
            matchedAbilitiesForCategory.flatMap((link) =>
              link.ability.categories
                .filter((cat) =>
                  parsedSearchCriteria.abilityCategory.includes(
                    cat.name.toLowerCase()
                  )
                )
                .map((cat) => cat.name)
            )
          ),
        ];

        const displayAbilities = [
          ...new Set(
            matchedAbilitiesForCategory.map((link) => link.ability.name)
          ),
        ];

        if (displayCategories.length > 0) {
          length += `
> Categories: *${displayCategories.join(", ")}*`.length;
          length += `
> Matching Abilities: *${displayAbilities.join(", ")}*`.length;
        }
      }
    }

    if (parsedSearchCriteria.attackType.length > 0) {
      const matchedAttacksOutput = new Set<string>();

      parsedSearchCriteria.attackType.forEach((criteria) => {
        const parts = criteria.toLowerCase().split(/\s+/).filter(Boolean);
        const searchAttackTypes: AttackTypeEnum[] = [];
        const searchProperties: string[] = [];

        parts.forEach((part) => {
          if (ATTACK_TYPE_KEYWORDS.includes(part.toUpperCase() as any)) {
            searchAttackTypes.push(part.toUpperCase() as AttackTypeEnum);
          } else if (part === "basic") {
            searchAttackTypes.push(...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[]));
          } else if (part === "special") {
            searchAttackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
          } else if (!MODIFIER_KEYWORDS.includes(part)) {
            searchProperties.push(part);
          }
        });

        champion.attacks.forEach((attack) => {
          const attackTypeMatch =
            searchAttackTypes.length === 0 ||
            searchAttackTypes.includes(attack.type);

          if (attackTypeMatch) {
            const hasAllProperties = searchProperties.every((prop) => {
              if (prop === "non-contact") {
                return attack.hits.some(
                  (h) =>
                    !h.properties.includes("Contact") && h.properties.length > 0
                );
              } else {
                return attack.hits.some((h) =>
                  h.properties.some((p) => p.toLowerCase() === prop)
                );
              }
            });

            if (hasAllProperties) {
              const props =
                attack.hits.flatMap((h) => h.properties).join(", ") ||
                "No Properties";
              matchedAttacksOutput.add(`${attack.type} (${props})`);
            }
          }
        });
      });

      if (matchedAttacksOutput.size > 0) {
        length += `
> Matched Attacks: *${[...matchedAttacksOutput].join(
          "; "
        )}*`.length;
      }
    }

    return length;
  };

  for (const champion of champions) {
    const championLength = getChampionStringLength(champion);

    if (
      currentLength + championLength >
      EMBED_DESCRIPTION_LIMIT - HEADER_FOOTER_BUFFER
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = 0;
    }

    currentPage.push(champion);
    currentLength += championLength;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}
