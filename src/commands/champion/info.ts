import { ChampionWithAllRelations } from "../../services/championService";
import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR, FullAbilities } from "./view";

export function handleInfo(champion: ChampionWithAllRelations): CommandResult {
  const fullAbilities = champion.fullAbilities as FullAbilities;

  if (
    !fullAbilities ||
    (!fullAbilities.signature && !fullAbilities.abilities_breakdown)
  ) {
    return {
      content: `Detailed abilities are not available for ${champion.name}.`,
      flags: MessageFlags.Ephemeral,
    };
  }

  const containers: ContainerBuilder[] = [];
  let currentContainer = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  let currentLength = 0;
  const MAX_CONTAINER_LENGTH = 4000;
  const MAX_TEXT_DISPLAY_LENGTH = 2000;

  const addTextToContainer = (text: string) => {
    if (currentLength + text.length > MAX_CONTAINER_LENGTH) {
      containers.push(currentContainer);
      currentContainer = new ContainerBuilder().setAccentColor(
        CLASS_COLOR[champion.class]
      );
      currentLength = 0;
    }
    currentContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(text)
    );
    currentLength += text.length;
  };

  const addBlock = (title: string, description: string) => {
    addTextToContainer(`**${title}**`);
    const descParts =
      description.match(new RegExp(`.{1,${MAX_TEXT_DISPLAY_LENGTH}}`, "gs")) ||
      [];
    for (const part of descParts) {
      addTextToContainer(part);
    }
  };

  addTextToContainer(`**${champion.name}**\n*${champion.class}*`);

  if (fullAbilities.signature) {
    const sig = fullAbilities.signature;
    addBlock(
      sig.name || "Signature Ability",
      sig.description || "No description."
    );
  }

  if (fullAbilities.abilities_breakdown) {
    for (const abilityBlock of fullAbilities.abilities_breakdown) {
      addBlock(
        abilityBlock.title || "Ability",
        abilityBlock.description || "No description."
      );
    }
  }

  if (currentContainer.components.length > 0) {
    containers.push(currentContainer);
  }

  return {
    components: containers,
    isComponentsV2: true,
  };
}
