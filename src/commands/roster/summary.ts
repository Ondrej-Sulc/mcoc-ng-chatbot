import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { getRoster, RosterWithChampion } from "../../services/rosterService";

const CLASS_EMOJIS: Record<string, string> = {
  MYSTIC: "<:Mystic:1253449751555215504>",
  MUTANT: "<:Mutant:1253449731284406332>",
  SKILL: "<:Skill:1253449798825279660>",
  SCIENCE: "<:Science:1253449774271696967>",
  COSMIC: "<:Cosmic:1253449702595235950>",
  TECH: "<:Tech:1253449817808703519>",
};

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

  const byStar = roster.reduce((acc, champ) => {
    if (!acc[champ.stars]) {
      acc[champ.stars] = [];
    }
    acc[champ.stars].push(champ);
    return acc;
  }, {} as Record<number, RosterWithChampion[]>);

  const container = new ContainerBuilder();
  const title = new TextDisplayBuilder().setContent(
    `### Roster Summary for ${player.ingameName}\n**Total Champions:** ${roster.length}`
  );
  container.addTextDisplayComponents(title);

  Object.entries(byStar)
    .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by star level descending
    .forEach(([stars, champions]: [string, RosterWithChampion[]]) => {
      let starSummary = `### ${stars}-Star Champions (${champions.length} total)\n`;

      const byRank = (champions as RosterWithChampion[]).reduce((acc: Record<number, number>, champ: RosterWithChampion) => {
        acc[champ.rank] = (acc[champ.rank] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      starSummary += `**By Rank:** `;
      starSummary += Object.entries(byRank)
        .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by rank descending
        .map(([rank, count]) => `R${rank}: ${count}`)
        .join(" | ");

      const byClass = (champions as RosterWithChampion[]).reduce((acc: Record<string, number>, champ: RosterWithChampion) => {
        acc[champ.champion.class] = (acc[champ.champion.class] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      starSummary += `\n**By Class:** `;
      starSummary += Object.entries(byClass)
        .map(
          ([className, count]) =>
            `${CLASS_EMOJIS[className] || className}${count}`
        )
        .join(" | ");

      const starContent = new TextDisplayBuilder().setContent(starSummary);
      container.addTextDisplayComponents(starContent);
    });

  await interaction.editReply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  });
}
