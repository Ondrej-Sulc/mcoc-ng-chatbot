import {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { AQState, SectionKey } from "./aqState";

export function buildProgressLines(state: AQState): string {
  const allUserIds = new Set<string>();
  for (const section of ["s1", "s2", "s3"] as SectionKey[]) {
    for (const uid of Object.keys(state.players[section])) allUserIds.add(uid);
  }
  const sorted = Array.from(allUserIds).sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : 1
  );
  if (sorted.length === 0) return "No players registered";

  const lines: string[] = [];
  for (const userId of sorted) {
    const s1 = state.players.s1[userId]?.done ? "🏆" : "⚔️";
    const s2 = state.players.s2[userId]?.done ? "🏆" : "⚔️";
    const s3 = state.players.s3[userId]?.done ? "🏆" : "⚔️";
    lines.push(`${s1} ${s2} ${s3} <@${userId}>`);
  }
  lines.push("Legend: ⚔️ = In Progress, 🏆 = Completed");
  return lines.join("\n");
}

export function buildAQContainer(state: AQState): ContainerBuilder {
  const container = new ContainerBuilder();
  const header = new TextDisplayBuilder().setContent(
    `**Alliance Quest – Day ${state.day}**\nStatus: ${state.mapStatus}`
  );
  const endTs = Math.floor(new Date(state.endTimeIso).getTime() / 1000);
  const timing = new TextDisplayBuilder().setContent(`Ends <t:${endTs}:R>`);
  const progress = new TextDisplayBuilder().setContent(
    buildProgressLines(state)
  );

  container.addTextDisplayComponents(header, timing, progress);

  const pathButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("aq:path:s1")
      .setLabel("Path S1")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("aq:path:s2")
      .setLabel("Path S2")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("aq:path:s3")
      .setLabel("Path S3")
      .setStyle(ButtonStyle.Secondary)
  );

  const clearButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("aq:boss:s1")
      .setLabel("Mini S1 Down")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("aq:boss:s2")
      .setLabel("Mini S2 Down")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("aq:map_clear")
      .setLabel("MAP CLEAR")
      .setStyle(ButtonStyle.Success)
  );

  container.addActionRowComponents(pathButtons, clearButtons);
  return container;
}
