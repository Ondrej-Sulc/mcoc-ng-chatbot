import { ChampionWithAllRelations } from "../../services/championService";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR, formatTags } from "./view";

export function handleTags(
  champion: ChampionWithAllRelations
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const formattedTags = formatTags(champion.tags);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedTags)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}
