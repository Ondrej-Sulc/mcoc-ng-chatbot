import {
  ChampionWithAllRelations,
  ChampionAbilityLinkWithAbility,
} from "../../services/championService";
import {
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { CommandResult } from "../../types/command";
import {
  CLASS_COLOR,
  formatLinkedAbilitySection,
  formatAttacks,
  formatTags,
} from "./view";

export function handleOverview(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );

  const abilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithAbility) => a.type === "ABILITY"
  );
  const immunities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithAbility) => a.type === "IMMUNITY"
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

  sections.forEach((section, index) => {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${section.title}`)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(section.content)
    );

    if (index < sections.length - 1) {
      container.addSeparatorComponents(new SeparatorBuilder());
    }
  });

  if (sections.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "This champion has no listed abilities, immunities, tags, or attacks."
      )
    );
  }

  return {
    components: [container],
    isComponentsV2: true,
  };
}