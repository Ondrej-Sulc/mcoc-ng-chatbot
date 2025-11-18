import { Duel, DuelStatus } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { ChampionWithAllRelations } from "../../services/championService";

export function getDuelContent(
  duels: Duel[],
  resolveEmoji: (text: string) => string
): string {
  let content = "";
  if (!duels || duels.length === 0) {
    content = "No active or outdated duel targets found for this champion.";
  } else {
    // Sort duels to show ACTIVE ones first
    const sortedDuels = [...duels].sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
      return 0;
    });

    content = sortedDuels
      .map((duel) => {
        let duelString = `### \`${duel.playerName}\``;
        if (duel.rank) {
          duelString += ` (${duel.rank})`;
        }

        // Add source indicator
        if (duel.source === "user_suggestion") {
          duelString += " 👤";
        } else if (duel.source === "community_csv") {
          duelString += " <:GuiaMTC:0>"; // Placeholder for resolver
        }

        // Add status indicator for outdated duels
        if (duel.status === "OUTDATED") {
          duelString += " ⚠️ (Outdated)";
        }

        return duelString;
      })
      .join("\n");
  }

  return resolveEmoji(content);
}

export function addDuelComponents(
  container: ContainerBuilder,
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
) {
  // Conditionally add GuiaMTC credit after buttons
  const duelsToShow = champion.duels.filter(
    (d) => d.status === DuelStatus.ACTIVE || d.status === DuelStatus.OUTDATED
  );
  const hasGuiaMTCSourcedDuels = duelsToShow.some(
    (duel) => duel.source === "community_csv"
  );
  if (hasGuiaMTCSourcedDuels) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        resolveEmoji("\nSources: <:GuiaMTC:0> *GuiaMTC.com*")
      )
    );
  }
  
  // Help text for duel buttons
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "*Have a suggestion or see an outdated target? Use the buttons below!*"
    )
  );

  const duelActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`champion-duel-suggest_${champion.id}`)
      .setLabel("Suggest New Target")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId(`champion-duel-report_${champion.id}`)
      .setLabel("Report Outdated Target")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🚨")
  );
  container.addActionRowComponents(duelActionRow);
}
