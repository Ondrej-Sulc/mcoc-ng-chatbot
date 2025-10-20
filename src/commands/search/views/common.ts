import {
  ChampionWithRelations,
  SearchCoreParams,
} from "../../../types/search";
import { ChampionClass, AbilityCategory, Hit, AttackType as AttackTypeEnum } from "@prisma/client";
import { parseAndOrConditions, isAttackType, ATTACK_TYPE_KEYWORDS, MODIFIER_KEYWORDS } from "../queryBuilder";

export const CLASS_EMOJIS: Record<ChampionClass, string> = {
  MYSTIC: "<:Mystic:1253449751555215504>",
  MUTANT: "<:Mutant:1253449731284406332>",
  SKILL: "<:Skill:1253449798825279660>",
  SCIENCE: "<:Science:1253449774271696967>",
  COSMIC: "<:Cosmic:1253449702595235950>",
  TECH: "<:Tech:1253449817808703519>",
  SUPERIOR: "<:Superior:1253458213618323660>",
};

export function getCriteriaString(
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

export function getChampionDetailsString(
  champion: ChampionWithRelations,
  parsedSearchCriteria: any,
) {
  let details: string[] = [];

  const matchedAbilities = champion.abilities
    .filter(
      (link: ChampionWithRelations['abilities'][number]) =>
        link.type === "ABILITY" &&
        parsedSearchCriteria.abilities.includes(
          link.ability.name.toLowerCase()
        )
    )
    .map((link: ChampionWithRelations['abilities'][number]) => {
      let abilityString = link.ability.name;
      if (link.source) {
        abilityString += ` (${link.source})`;
      }
      return abilityString;
    });
  if (matchedAbilities.length > 0) {
    details.push(`> Abilities: *${matchedAbilities.join(", ")}*`);
  }

  const matchedImmunities = champion.abilities
    .filter(
      (link: ChampionWithRelations['abilities'][number]) =>
        link.type === "IMMUNITY" &&
        parsedSearchCriteria.immunities.includes(
          link.ability.name.toLowerCase()
        )
    )
    .map((link: ChampionWithRelations['abilities'][number]) => {
      let immunityString = link.ability.name;
      if (link.source) {
        immunityString += ` (${link.source})`;
      }
      return immunityString;
    });
  if (matchedImmunities.length > 0) {
    details.push(`> Immunities: *${matchedImmunities.join(", ")}*`);
  }

  const matchedTags = champion.tags
    .filter((tag: ChampionWithRelations['tags'][number]) =>
      parsedSearchCriteria.tags.includes(tag.name.toLowerCase())
    )
    .map((tag: ChampionWithRelations['tags'][number]) => tag.name);
  if (matchedTags.length > 0) {
    details.push(`> Tags: *${matchedTags.join(", ")}*`);
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
        details.push(`> Categories: *${displayCategories.join(", ")}*`);
        details.push(`> Matching Abilities: *${displayAbilities.join(
          ", "
        )}*`);
      }
    }
  }

  if (parsedSearchCriteria.attackType.length > 0) {
    const matchedAttacksOutput = new Set<string>();

    parsedSearchCriteria.attackType.forEach((criteria: string) => {
      const parts = criteria.toLowerCase().split(/\s+/).filter(Boolean);
      const searchAttackTypes: AttackTypeEnum[] = [];
      const searchProperties: string[] = [];

      parts.forEach((part: string) => {
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
      details.push(`> Matched Attacks: *${[...matchedAttacksOutput].join(
        "; "
      )}*`);
    }
  }

  return details.join("\n");
}

export function getChampionDisplayLength(champion: ChampionWithRelations, parsedSearchCriteria: any): number {
  const details = getChampionDetailsString(champion, parsedSearchCriteria);
  const classEmoji = CLASS_EMOJIS[champion.class];
  const championEmoji = champion.discordEmoji || "";
  return champion.name.length + details.length + classEmoji.length + championEmoji.length + 10; // Extra buffer for formatting
}