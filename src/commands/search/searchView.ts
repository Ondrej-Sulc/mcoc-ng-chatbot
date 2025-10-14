import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Guild,
} from "discord.js";
import { createEmojiResolver } from "../../utils/emojiResolver";
import {
  ChampionWithRelations,
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../types/search";
import { ChampionClass, AbilityCategory, Hit, AttackType as AttackTypeEnum } from "@prisma/client";
import { parseAndOrConditions, isAttackType, ATTACK_TYPE_KEYWORDS, MODIFIER_KEYWORDS } from "./queryBuilder";

export const CLASS_EMOJIS: Record<ChampionClass, string> = {
  MYSTIC: "<:Mystic:1253449751555215504>",
  MUTANT: "<:Mutant:1253449731284406332>",
  SKILL: "<:Skill:1253449798825279660>",
  SCIENCE: "<:Science:1253449774271696967>",
  COSMIC: "<:Cosmic:1253449702595235950>",
  TECH: "<:Tech:1253449817808703519>",
  SUPERIOR: "<:Superior:1253458213618323660>",
};

function getCriteriaString(
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">
) {
  const criteriaParts: string[] = [];
  for (const [key, value] of Object.entries(searchCriteria)) {
    if (value) {
      const formattedKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      criteriaParts.push(`**${formattedKey}:** 
${value}
`);
    }
  }
  return criteriaParts.join("\n");
}

export async function generateResponse(
  client: Client,
  guild: Guild | null,
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
  const resolveEmoji = createEmojiResolver(client);

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
          const upperPart = part.toUpperCase();
          if (isAttackType(upperPart)) {
            searchAttackTypes.push(upperPart);
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

export async function generateRosterResponse(
  client: Client,
  guild: Guild | null,
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
  const resolveEmoji = createEmojiResolver(client);

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
