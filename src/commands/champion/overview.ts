import {
  ChampionWithAllRelations,
  ChampionAbilityLinkWithRelations,
} from "../../services/championService";
import {
  formatLinkedAbilitySection,
  formatAttacks,
  formatTags,
} from "./view";

export function getOverviewContent(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): string {
  const abilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithRelations) => a.type === "ABILITY"
  );
  const immunities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithRelations) => a.type === "IMMUNITY"
  );

  const sections = [];

  if (abilities.length > 0) {
    sections.push({
      title: "Abilities",
      content: formatLinkedAbilitySection(abilities, resolveEmoji, "Abilities", 'compact'),
    });
  }

  if (immunities.length > 0) {
    sections.push({
      title: "Immunities",
      content: formatLinkedAbilitySection(immunities, resolveEmoji, "Immunities", 'compact'),
    });
  }

  if (champion.tags.length > 0) {
    sections.push({
      title: "Tags",
      content: formatTags(champion.tags),
    });
  }

  if (champion.attacks.length > 0) {
    sections.push({
      title: "Attacks",
      content: formatAttacks(champion.attacks, 'compact'),
    });
  }

  if (sections.length === 0) {
    return "This champion has no listed abilities, immunities, tags, or attacks.";
  }

  return sections.map(section => `## ${section.title}\n${section.content}`).join("\n\n---\n\n");
}