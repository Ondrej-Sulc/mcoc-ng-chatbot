import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { getRoster, RosterWithChampion } from "../../services/rosterService";

// TODO: Refactor into a shared utility
const CLASS_EMOJIS: Record<string, string> = {
  MYSTIC: "<:Mystic:1253449751555215504>",
  MUTANT: "<:Mutant:1253449731284406332>",
  SKILL: "<:Skill:1253449798825279660>",
  SCIENCE: "<:Science:1253449774271696967>",
  COSMIC: "<:Cosmic:1253449702595235950>",
  TECH: "<:Tech:1253449817808703519>",
};

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
      let starSummary = `### ${stars}-Star Champions (${champions.length} total)\n`;

      const byRank = (champions as RosterWithChampion[]).reduce(
        (acc: Record<number, number>, champ: RosterWithChampion) => {
          acc[champ.rank] = (acc[champ.rank] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>
      );

      starSummary += `**By Rank:** `;
      starSummary += Object.entries(byRank)
        .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by rank descending
        .map(([rank, count]) => `R${rank}: ${count}`)
        .join(" | ");

      const byClass = (champions as RosterWithChampion[]).reduce(
        (acc: Record<string, number>, champ: RosterWithChampion) => {
          acc[champ.champion.class] = (acc[champ.champion.class] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

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
}

export async function handleView(interaction: ChatInputCommandInteraction) {

  const player = await getPlayer(interaction);
  if (!player) {
    return;
  }

  const container = new ContainerBuilder();
  const title = new TextDisplayBuilder().setContent(
    `# Profile for ${player.ingameName}`
  );
  container.addTextDisplayComponents(title);

  //Timezone Info
  const timezoneInfo = new TextDisplayBuilder().setContent(
    `**Timezone:** ${player.timezone || "Not set"}`
  );
  container.addTextDisplayComponents(timezoneInfo);

  // Prestige Info
  let prestigeInfo = "## Prestige\n";
  prestigeInfo += `**Summoner:** ${player.summonerPrestige || "Not set"}\n`;
  prestigeInfo += `**Champion:** ${player.championPrestige || "Not set"}\n`;
  prestigeInfo += `**Relic:** ${player.relicPrestige || "Not set"}`;
  const prestigeComponent = new TextDisplayBuilder().setContent(prestigeInfo);
  container.addTextDisplayComponents(prestigeComponent);

  // Roster Summary
  const roster = await getRoster(player.id, null, null, null);

  if (typeof roster !== "string" && roster.length > 0) {
    const rosterTitle = new TextDisplayBuilder().setContent(
      `## Roster Summary (Total: ${roster.length})`
    );
    container.addTextDisplayComponents(rosterTitle);
    buildRosterSummary(roster, container);
  } else {
    const noRoster = new TextDisplayBuilder().setContent("## Roster Summary\nNo roster data found.");
    container.addTextDisplayComponents(noRoster);
  }

  await interaction.editReply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  });
}
