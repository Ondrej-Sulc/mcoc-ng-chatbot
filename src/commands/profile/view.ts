import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../services/prismaService";
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
          .map(
            ([className, count]) =>
              `${CLASS_EMOJIS[className] || className}${count}`
          )
          .join(" | ") || "N/A";

      const starContent = new TextDisplayBuilder().setContent(starSummary);
      container.addTextDisplayComponents(starContent);
    });
}

export async function handleView(interaction: ChatInputCommandInteraction) {
  const player = await prisma.player.findFirst({
    where: {
      discordId: interaction.user.id,
      isActive: true,
    },
    include: {
      alliance: true,
    },
  });

  if (!player) {
    await interaction.editReply(
      "You do not have an active profile. Use `/profile switch` to set one, or `/profile add` to create one."
    );
    return;
  }

  const container = new ContainerBuilder();
  const title = new TextDisplayBuilder().setContent(
    `# 👤 Profile for ${player.ingameName} ${player.isActive ? "*(Active)*" : ""}`
  );
  container.addTextDisplayComponents(title);

  // Alliance and Timezone Info
  const allianceName = player.alliance
    ? player.alliance.name
    : "Not in an alliance";
  const generalInfo = new TextDisplayBuilder().setContent(
    `**Alliance:** ${allianceName}\n**Timezone:** 🕒 ${player.timezone || "Not set"}`
  );
  container.addTextDisplayComponents(generalInfo);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Prestige Info
  let prestigeInfo = "## 🏆 Prestige\n";
  prestigeInfo += `**Summoner:** ${player.summonerPrestige || "N/A"} | `;
  prestigeInfo += `**Champion:** ${player.championPrestige || "N/A"} | `;
  prestigeInfo += `**Relic:** ${player.relicPrestige || "N/A"}`;
  const prestigeComponent = new TextDisplayBuilder().setContent(prestigeInfo);
  container.addTextDisplayComponents(prestigeComponent);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Roster Summary
  const roster = await getRoster(player.id, null, null, null);

  if (typeof roster !== "string" && roster.length > 0) {
    const rosterTitle = new TextDisplayBuilder().setContent(
      `## 📈 Roster Summary (Total: ${roster.length})`
    );
    container.addTextDisplayComponents(rosterTitle);
    buildRosterSummary(roster, container);
  } else {
    const noRoster = new TextDisplayBuilder().setContent(
      "## 📈 Roster Summary\nNo roster data found. Use `/roster update` to add your champions."
    );
    container.addTextDisplayComponents(noRoster);
  }

  await interaction.editReply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  });
}