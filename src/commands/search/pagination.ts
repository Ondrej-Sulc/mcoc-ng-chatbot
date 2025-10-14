import { Client } from "discord.js";
import { ChampionWithRelations, RosterEntryWithChampionRelations, SearchCoreParams } from "../../types/search";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { CLASS_EMOJIS } from "./searchView";
import { parseAndOrConditions, isAttackType, ATTACK_TYPE_KEYWORDS, MODIFIER_KEYWORDS } from "./queryBuilder";
import { ChampionClass, AbilityCategory, Hit, AttackType as AttackTypeEnum } from "@prisma/client";

const EMBED_DESCRIPTION_LIMIT = 4096;
const PER_CHAMPION_BASE_LENGTH = 50; // Base length for "emoji **Name**\n"
const HEADER_FOOTER_BUFFER = 200; // Buffer for title, footer, etc.
const SEPARATOR_LENGTH = 2; // `\n\n`

export function paginateChampions(
  client: Client,
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  criteriaLength: number
): ChampionWithRelations[][] {
  const pages: ChampionWithRelations[][] = [];
  let currentPage: ChampionWithRelations[] = [];
  let currentLength = criteriaLength + HEADER_FOOTER_BUFFER;

  const resolveEmoji = createEmojiResolver(client);

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
              }
              else {
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

export function paginateRosterChampions(
  client: Client,
  rosterEntries: RosterEntryWithChampionRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  criteriaLength: number
): RosterEntryWithChampionRelations[][] {
  const pages: RosterEntryWithChampionRelations[][] = [];
  let currentPage: RosterEntryWithChampionRelations[] = [];
  let currentLength = criteriaLength + HEADER_FOOTER_BUFFER;
  const resolveEmoji = createEmojiResolver(client);

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
