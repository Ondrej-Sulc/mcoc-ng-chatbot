import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { getRoster, RosterWithChampion } from "../../services/rosterService";

import { getApplicationEmojiMarkupByName } from "../../services/applicationEmojiService";

function buildRosterSummary(
  roster: RosterWithChampion[],
  container: ContainerBuilder
) {
  const byStar = roster.reduce((acc, champ) => {
    if (!acc[champ.stars]) {
      acc[champ.stars] = [];
    }
    acc[champ.stars].push(champ);
    return acc;
  }, {} as Record<number, RosterWithChampion[]>);

  Object.entries(byStar)
    .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by star level descending
    .forEach(([stars, champions]: [string, RosterWithChampion[]]) => {
      let starSummary = `### ${"⭐".repeat(
        parseInt(stars)
      )} ${stars}-Star Champions (${champions.length} total)\n`;

      const byRank = (champions as RosterWithChampion[]).reduce(
        (acc: Record<number, number>, champ: RosterWithChampion) => {
          acc[champ.rank] = (acc[champ.rank] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>
      );

      starSummary += `**By Rank:** `;
      starSummary +=
        Object.entries(byRank)
          .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by rank descending
          .map(([rank, count]) => `R${rank}: ${count}`)
          .join(" | ") || "N/A";
      starSummary += "\n";

      const byClass = (champions as RosterWithChampion[]).reduce(
        (acc: Record<string, number>, champ: RosterWithChampion) => {
          acc[champ.champion.class] = (acc[champ.champion.class] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      starSummary += `**By Class:** `;
      starSummary +=
        Object.entries(byClass)
          .map(([className, count]) => {
            const capitalizedClassName =
              className.charAt(0).toUpperCase() +
              className.slice(1).toLowerCase();
            const emoji = getApplicationEmojiMarkupByName(capitalizedClassName);
            return `${emoji || capitalizedClassName}${count}`;
          })
          .join(" | ") || "N/A";

      const starContent = new TextDisplayBuilder().setContent(starSummary);
      container.addTextDisplayComponents(starContent);
    });
}

export async function handleSummary(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const player = await getPlayer(interaction);
  if (!player) {
    return;
  }

  const roster = await getRoster(player.id, null, null, null);

  if (typeof roster === "string") {
    await interaction.editReply({ content: roster });
    return;
  }

  const container = new ContainerBuilder();
  const rosterTitle = new TextDisplayBuilder().setContent(
    `## 📈 Roster Summary (Total: ${roster.length})`
  );
  container.addTextDisplayComponents(rosterTitle);
  buildRosterSummary(roster, container);

  await interaction.editReply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  });
}