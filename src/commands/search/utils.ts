import {
  Prisma,
  PrismaClient,
  ChampionClass,
  AttackType as AttackTypeEnum,
  AbilityCategory,
  Hit,
} from "@prisma/client";
import {
  SearchCoreParams,
  ChampionWithRelations,
  RosterEntryWithChampionRelations,
} from "../../types/search";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Guild,
} from "discord.js";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { prisma } from "../../services/prismaService";

// Store by name so we can resolve IDs dynamically per-guild
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
const SEPARATOR_LENGTH = 2; // `\n\n`

export type SearchCacheEntry = {
  criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">;
  pages: ChampionWithRelations[][];
};
export const searchCache = new Map<string, SearchCacheEntry>();

export type RosterSearchCacheEntry = {
  criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">;
  pages: RosterEntryWithChampionRelations[][];
};
export const rosterSearchCache = new Map<string, RosterSearchCacheEntry>();

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
  const {
    abilities,
    immunities,
    tags,
    championClass,
    abilityCategory,
    attackType,
  } = params;

  if (championClass) {
    const { conditions, useAnd } = parseAndOrConditions(championClass);
    const classEnums = conditions
      .map((c) => c.toUpperCase())
      .filter((c) => Object.keys(ChampionClass).includes(c)) as ChampionClass[];

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
          attackTypes.push(
            ...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[])
          );
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
          const normalizedProp = part.charAt(0).toUpperCase() + part.slice(1);
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

function getCriteriaString(
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">
) {
  const criteriaParts: string[] = [];
  for (const [key, value] of Object.entries(searchCriteria)) {
    if (value) {
      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      criteriaParts.push(`**${formattedKey}:** \`${value}\``);
    }
  }
  return criteriaParts.join("\n");
}

export async function generateResponse(
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string
): Promise<{
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder> | null;
}> {
  const maybeClient: Client | undefined = (global as any).__discordClient;
  const maybeGuild: Guild | null = (global as any).__discordGuild || null;
  const resolveEmoji = maybeClient
    ? createEmojiResolver(maybeClient)
    : (t: string) => t;

  const descriptionLines: string[] = [];
  const parsedSearchCriteria = {
    abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map(
      (c) => c.toLowerCase()
    ),
    immunities: parseAndOrConditions(searchCriteria.immunities).conditions.map(
      (c) => c.toLowerCase()
    ),
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

  for (const champion of champions) {
    const classEmoji = CLASS_EMOJIS[champion.class];
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    let champString = `${championEmoji} **${champion.name}** ${classEmoji}`;

    const matchedAbilities = champion.abilities
      .filter(
        (link: ChampionWithRelations['abilities'][number]) =>
          link.type === "ABILITY" &&
          parsedSearchCriteria.abilities.includes(
            link.ability.name.toLowerCase()
          )
      )
      .map((link: ChampionWithRelations['abilities'][number]) => link.ability.name);
    if (matchedAbilities.length > 0) {
      champString += `\n> Abilities: *${matchedAbilities.join(", ")}*`;
    }

    const matchedImmunities = champion.abilities
      .filter(
        (link: ChampionWithRelations['abilities'][number]) =>
          link.type === "IMMUNITY" &&
          parsedSearchCriteria.immunities.includes(
            link.ability.name.toLowerCase()
          )
      )
      .map((link: ChampionWithRelations['abilities'][number]) => link.ability.name);
    if (matchedImmunities.length > 0) {
      champString += `\n> Immunities: *${matchedImmunities.join(", ")}*`;
    }

    const matchedTags = champion.tags
      .filter((tag: ChampionWithRelations['tags'][number]) =>
        parsedSearchCriteria.tags.includes(tag.name.toLowerCase())
      )
      .map((tag: ChampionWithRelations['tags'][number]) => tag.name);
    if (matchedTags.length > 0) {
      champString += `\n> Tags: *${matchedTags.join(", ")}*`;
    }

    if (parsedSearchCriteria.abilityCategory.length > 0) {
      const matchedAbilitiesForCategory = champion.abilities.filter((link: ChampionWithRelations['abilities'][number]) =>
        link.ability.categories.some((cat: AbilityCategory) =>
          parsedSearchCriteria.abilityCategory.includes(cat.name.toLowerCase())
        )
      );

      if (matchedAbilitiesForCategory.length > 0) {
        const displayCategories = [
          ...new Set(
            matchedAbilitiesForCategory.flatMap((link: ChampionWithRelations['abilities'][number]) =>
              link.ability.categories
                .filter((cat: AbilityCategory) =>
                  parsedSearchCriteria.abilityCategory.includes(
                    cat.name.toLowerCase()
                  )
                )
                .map((cat: AbilityCategory) => cat.name)
            )
          ),
        ];

        const displayAbilities = [
          ...new Set(
            matchedAbilitiesForCategory.map((link: ChampionWithRelations['abilities'][number]) => link.ability.name)
          ),
        ];

        if (displayCategories.length > 0) {
          champString += `\n> Categories: *${displayCategories.join(", ")}*`;
          champString += `\n> Matching Abilities: *${displayAbilities.join(
            ", "
          )}*`;
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
            searchAttackTypes.push(
              ...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[])
            );
          } else if (part === "special") {
            searchAttackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
          } else if (!MODIFIER_KEYWORDS.includes(part)) {
            searchProperties.push(part);
          }
        });

        champion.attacks.forEach((attack: ChampionWithRelations['attacks'][number]) => {
          const attackTypeMatch =
            searchAttackTypes.length === 0 ||
            searchAttackTypes.includes(attack.type);

          if (attackTypeMatch) {
            const hasAllProperties = searchProperties.every((prop) => {
              if (prop === "non-contact") {
                return attack.hits.some(
                  (h: Hit) =>
                    !h.properties.includes("Contact") && h.properties.length > 0
                );
              } else {
                return attack.hits.some((h: Hit) =>
                  h.properties.some((p: string) => p.toLowerCase() === prop)
                );
              }
            });

            if (hasAllProperties) {
              const props =
                attack.hits.flatMap((h: Hit) => h.properties).join(", ") ||
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

  const criteriaString = getCriteriaString(searchCriteria);
  const header = `Found **${totalChampions}** champion(s) matching your criteria.\n${
    criteriaString ? `\n${criteriaString}\n` : ""
  }`;
  const fullDescription = `${header}\n${descriptionLines.join("\n\n")}`;

  const embed = new EmbedBuilder()
    .setTitle("Champion Search Results")
    .setDescription(fullDescription)
    .setColor("Gold");

  let row: ActionRowBuilder<ButtonBuilder> | null = null;
  if (totalPages > 1) {
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
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  criteriaLength: number
): ChampionWithRelations[][] {
  const pages: ChampionWithRelations[][] = [];
  let currentPage: ChampionWithRelations[] = [];
  let currentLength = criteriaLength + HEADER_FOOTER_BUFFER;

  const resolveEmoji = createEmojiResolver((global as any).__discordClient);

  const parsedSearchCriteria = {
    abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map(
      (c) => c.toLowerCase()
    ),
    immunities: parseAndOrConditions(searchCriteria.immunities).conditions.map(
      (c) => c.toLowerCase()
    ),
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

  const getChampionStringLength = (champion: ChampionWithRelations): number => {
    const classEmoji = CLASS_EMOJIS[champion.class];
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    let length =
      PER_CHAMPION_BASE_LENGTH +
      champion.name.length +
      classEmoji.length +
      championEmoji.length;

    const matchedAbilities = champion.abilities
      .filter(
        (link: ChampionWithRelations['abilities'][number]) =>
          link.type === "ABILITY" &&
          parsedSearchCriteria.abilities.includes(
            link.ability.name.toLowerCase()
          )
      )
      .map((link: ChampionWithRelations['abilities'][number]) => link.ability.name);
    if (matchedAbilities.length > 0) {
      length += `\n> Abilities: *${matchedAbilities.join(", ")}*`.length;
    }

    const matchedImmunities = champion.abilities
      .filter(
        (link: ChampionWithRelations['abilities'][number]) =>
          link.type === "IMMUNITY" &&
          parsedSearchCriteria.immunities.includes(
            link.ability.name.toLowerCase()
          )
      )
      .map((link: ChampionWithRelations['abilities'][number]) => link.ability.name);
    if (matchedImmunities.length > 0) {
      length += `\n> Immunities: *${matchedImmunities.join(", ")}*`.length;
    }

    const matchedTags = champion.tags
      .filter((tag: ChampionWithRelations['tags'][number]) =>
        parsedSearchCriteria.tags.includes(tag.name.toLowerCase())
      )
      .map((tag: ChampionWithRelations['tags'][number]) => tag.name);
    if (matchedTags.length > 0) {
      length += `\n> Tags: *${matchedTags.join(", ")}*`.length;
    }

    if (parsedSearchCriteria.abilityCategory.length > 0) {
      const matchedAbilitiesForCategory = champion.abilities.filter((link: ChampionWithRelations['abilities'][number]) =>
        link.ability.categories.some((cat: AbilityCategory) =>
          parsedSearchCriteria.abilityCategory.includes(cat.name.toLowerCase())
        )
      );

      if (matchedAbilitiesForCategory.length > 0) {
        const displayCategories = [
          ...new Set(
            matchedAbilitiesForCategory.flatMap((link: ChampionWithRelations['abilities'][number]) =>
              link.ability.categories
                .filter((cat: AbilityCategory) =>
                  parsedSearchCriteria.abilityCategory.includes(
                    cat.name.toLowerCase()
                  )
                )
                .map((cat: AbilityCategory) => cat.name)
            )
          ),
        ];

        const displayAbilities = [
          ...new Set(
            matchedAbilitiesForCategory.map((link: ChampionWithRelations['abilities'][number]) => link.ability.name)
          ),
        ];

        if (displayCategories.length > 0) {
          length += `\n> Categories: *${displayCategories.join(", ")}*`.length;
          length += `\n> Matching Abilities: *${displayAbilities.join(", ")}*`
            .length;
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
            searchAttackTypes.push(
              ...(["L1", "L2", "L3", "L4", "M1", "M2", "H"] as AttackTypeEnum[])
            );
          } else if (part === "special") {
            searchAttackTypes.push(...(["S1", "S2"] as AttackTypeEnum[]));
          } else if (!MODIFIER_KEYWORDS.includes(part)) {
            searchProperties.push(part);
          }
        });

        champion.attacks.forEach((attack: ChampionWithRelations['attacks'][number]) => {
          const attackTypeMatch =
            searchAttackTypes.length === 0 ||
            searchAttackTypes.includes(attack.type);

          if (attackTypeMatch) {
            const hasAllProperties = searchProperties.every((prop) => {
              if (prop === "non-contact") {
                return attack.hits.some(
                  (h: Hit) =>
                    !h.properties.includes("Contact") && h.properties.length > 0
                );
              } else {
                return attack.hits.some((h: Hit) =>
                  h.properties.some((p: string) => p.toLowerCase() === prop)
                );
              }
            });

            if (hasAllProperties) {
              const props =
                attack.hits.flatMap((h: Hit) => h.properties).join(", ") ||
                "No Properties";
              matchedAttacksOutput.add(`${attack.type} (${props})`);
            }
          }
        });
      });

      if (matchedAttacksOutput.size > 0) {
        length += `\n> Matched Attacks: *${[...matchedAttacksOutput].join(
          "; "
        )}*`.length;
      }
    }

    return length;
  };

  for (const champion of champions) {
    const championLength = getChampionStringLength(champion);

    if (
      currentPage.length > 0 &&
      currentLength + championLength + SEPARATOR_LENGTH >
        EMBED_DESCRIPTION_LIMIT
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = criteriaLength + HEADER_FOOTER_BUFFER;
    }

    currentPage.push(champion);
    currentLength +=
      championLength + (currentPage.length > 1 ? SEPARATOR_LENGTH : 0);
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export async function generateRosterResponse(
  champions: RosterEntryWithChampionRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string
): Promise<{
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder> | null;
}> {
  const maybeClient: Client | undefined = (global as any).__discordClient;
  const maybeGuild: Guild | null = (global as any).__discordGuild || null;
  const resolveEmoji = maybeClient
    ? createEmojiResolver(maybeClient)
    : (t: string) => t;

  const descriptionLines: string[] = [];

  for (const entry of champions) {
    const { champion } = entry;
    const classEmoji = CLASS_EMOJIS[champion.class];
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    const ascendedEmoji = entry.isAscended ? "🏆" : "";
    const awakenedEmoji = entry.isAwakened ? "★" : "☆";

    let champString = `${championEmoji} **${champion.name}** ${classEmoji}\n> ${awakenedEmoji} ${entry.stars}* R${entry.rank} ${ascendedEmoji}`;
    descriptionLines.push(champString);
  }

  const criteriaString = getCriteriaString(searchCriteria);
  const header = `Found **${totalChampions}** champion(s) in the roster matching your criteria.\n${
    criteriaString ? `\n${criteriaString}\n` : ""
  }`;
  const fullDescription = `${header}\n${descriptionLines.join("\n\n")}`;

  const embed = new EmbedBuilder()
    .setTitle("Roster Search Results")
    .setDescription(fullDescription)
    .setColor("Gold");

  let row: ActionRowBuilder<ButtonBuilder> | null = null;
  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${currentPage} of ${totalPages}` });

    row = new ActionRowBuilder<ButtonBuilder>();
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`roster_search:prev:${searchId}:${currentPage}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`roster_search:next:${searchId}:${currentPage}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages)
    );
  }

  return { embed, row };
}

export function paginateRosterChampions(
  rosterEntries: RosterEntryWithChampionRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  criteriaLength: number
): RosterEntryWithChampionRelations[][] {
  const pages: RosterEntryWithChampionRelations[][] = [];
  let currentPage: RosterEntryWithChampionRelations[] = [];
  let currentLength = criteriaLength + HEADER_FOOTER_BUFFER;
  const resolveEmoji = createEmojiResolver((global as any).__discordClient);

  const getRosterChampionStringLength = (
    entry: RosterEntryWithChampionRelations
  ): number => {
    const { champion } = entry;
    const classEmoji = CLASS_EMOJIS[champion.class];
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    const ascendedEmoji = entry.isAscended ? "🏆" : "";
    const awakenedEmoji = entry.isAwakened ? "★" : "☆";

    let length =
      PER_CHAMPION_BASE_LENGTH +
      champion.name.length +
      classEmoji.length +
      championEmoji.length;
    length +=
      `\n> ${awakenedEmoji} ${entry.stars}* R${entry.rank} ${ascendedEmoji}`
        .length;
    return length;
  };

  for (const entry of rosterEntries) {
    const championLength = getRosterChampionStringLength(entry);

    if (
      currentPage.length > 0 &&
      currentLength + championLength + SEPARATOR_LENGTH >
        EMBED_DESCRIPTION_LIMIT
    ) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = criteriaLength + HEADER_FOOTER_BUFFER;
    }

    currentPage.push(entry);
    currentLength +=
      championLength + (currentPage.length > 1 ? SEPARATOR_LENGTH : 0);
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}