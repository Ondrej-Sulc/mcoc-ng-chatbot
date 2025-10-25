import { ChampionWithAllRelations } from "../../services/championService";
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR } from "./view";

export function handleDuel(
  champion: ChampionWithAllRelations
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );

  if (!champion.duels || champion.duels.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("No duel targets found for this champion.")
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel("Find Duels on GuiaMTC")
            .setStyle(ButtonStyle.Link)
            .setURL("https://www.guiamtc.com/duels")
    );
    container.addActionRowComponents(row);
  } else {
    const duelList = champion.duels
      .map((duel) => {
        let duelString = `### \`${duel.playerName}\``;
        if (duel.rank) {
          duelString += ` (${duel.rank})`;
        }
        return duelString;
      })
      .join("\n");

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(duelList)
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("*Data provided by GuiaMTC.com*")
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}
