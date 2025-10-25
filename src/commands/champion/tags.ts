import { ChampionWithAllRelations } from "../../services/championService";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR } from "./view";
import { Tag } from "@prisma/client";

export function handleTags(
  champion: ChampionWithAllRelations
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );

  if (!champion.tags || champion.tags.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("No tags found for this champion.")
    );
    return {
      components: [container],
      isComponentsV2: true,
    };
  }

  const tagsByCategory = new Map<string, Tag[]>();
  for (const tag of champion.tags) {
    if (!tagsByCategory.has(tag.category)) {
      tagsByCategory.set(tag.category, []);
    }
    tagsByCategory.get(tag.category)?.push(tag);
  }

  let formattedTags = "";
  for (const [category, tags] of tagsByCategory.entries()) {
    formattedTags += `### ${category}\n`;
    formattedTags += tags
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => `- \`${t.name}\``)
      .join("\n");
    formattedTags += "\n";
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedTags.trim())
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}
