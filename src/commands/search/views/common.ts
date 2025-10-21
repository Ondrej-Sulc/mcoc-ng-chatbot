import {
  ChampionWithRelations,
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../../types/search";
import {
  ChampionClass,
  AbilityCategory,
  Hit,
  AttackType as AttackTypeEnum,
} from "@prisma/client";
import {
  parseAndOrConditions,
  isAttackType,
  ATTACK_TYPE_KEYWORDS,
  MODIFIER_KEYWORDS,
} from "../queryBuilder";

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
  parsedSearchCriteria: any
) {
  const details: string[] = [];

  const processLinks = (
    links: ChampionWithRelations["abilities"],
    type: "ABILITY" | "IMMUNITY",
    criteria: string[]
  ) => {
    const matchedLinks = links.filter(
      (link) =>
        link.type === type && criteria.includes(link.ability.name.toLowerCase())
    );

    if (matchedLinks.length === 0) return null;

    const grouped = new Map<string, string[]>();
    matchedLinks.forEach((link) => {
      if (!grouped.has(link.ability.name)) {
        grouped.set(link.ability.name, []);
      }
      if (link.source) {
        const sources = grouped.get(link.ability.name)!;
        if (!sources.includes(link.source)) {
          sources.push(link.source);
        }
      }
    });

    const strings = Array.from(grouped.entries()).map(([name, sources]) => {
      if (sources.length > 0) {
        return `**${name}** (${sources.join(" | ")})`;
      }
      return `**${name}**`;
    });
    return strings.join(", ");
  };

  if (parsedSearchCriteria.abilities.length > 0) {
    const abilitiesString = processLinks(
      champion.abilities,
      "ABILITY",
      parsedSearchCriteria.abilities
    );
    if (abilitiesString) {
      details.push(`> *Abilities:* ${abilitiesString}`);
    }
  }

  if (parsedSearchCriteria.immunities.length > 0) {
    const immunitiesString = processLinks(
      champion.abilities,
      "IMMUNITY",
      parsedSearchCriteria.immunities
    );
    if (immunitiesString) {
      details.push(`> *Immunities:* ${immunitiesString}`);
    }
  }

  if (parsedSearchCriteria.tags.length > 1) {
    const matchedTags = champion.tags
      .filter((tag) =>
        parsedSearchCriteria.tags.includes(tag.name.toLowerCase())
      )
      .map((tag) => tag.name);
    if (matchedTags.length > 0) {
      details.push(`> *Tags:* ${matchedTags.join(", ")}`);
    }
  }

  if (parsedSearchCriteria.abilityCategory.length > 0) {
    const matchedAbilitiesForCategory = champion.abilities.filter(
      (link) =>
        link.type === "ABILITY" &&
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

      const groupedAbilities = new Map<string, string[]>();

      matchedAbilitiesForCategory.forEach((link) => {
        if (!groupedAbilities.has(link.ability.name)) {
          groupedAbilities.set(link.ability.name, []);
        }

        if (link.source) {
          const sources = groupedAbilities.get(link.ability.name)!;

          if (!sources.includes(link.source)) {
            sources.push(link.source);
          }
        }
      });

      const displayAbilities = Array.from(groupedAbilities.entries()).map(
        ([name, sources]) => {
          if (sources.length > 0) {
            return `**${name}** (${sources.join(" | ")})`;
          }

          return `**${name}**`;
        }
      );

      if (displayCategories.length > 0) {
        if (parsedSearchCriteria.abilityCategory.length > 1) {
          details.push(`> *Categories:* ${displayCategories.join(", ")}`);
        }

        details.push(`> *Matching Abilities:* ${displayAbilities.join(", ")}`);
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
      details.push(
        `> Matched Attacks: *${[...matchedAttacksOutput].join("; ")}*`
      );
    }
  }

  return details.join("\n");
}

export function getChampionDisplayLength(
  champion: ChampionWithRelations,
  parsedSearchCriteria: any
): number {
  const details = getChampionDetailsString(champion, parsedSearchCriteria);
  const classEmoji = CLASS_EMOJIS[champion.class];
  const championEmoji = champion.discordEmoji || "";
  return (
    champion.name.length +
    details.length +
    classEmoji.length +
    championEmoji.length +
    10
  );
}

export function getRosterEntryDisplayLength(
  entry: RosterEntryWithChampionRelations,
  parsedSearchCriteria: any
): number {
  const championLength = getChampionDisplayLength(
    entry.champion,
    parsedSearchCriteria
  );
  const ascendedEmoji = entry.isAscended ? "🏆" : "";
  const awakenedEmoji = entry.isAwakened ? "★" : "☆";
  const rosterInfoLength =
    ` ${awakenedEmoji} ${entry.stars}* R${entry.rank} ${ascendedEmoji}`.length;
  return championLength + rosterInfoLength;
}
