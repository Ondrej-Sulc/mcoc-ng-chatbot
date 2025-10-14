import {
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { getRoster } from "../../services/rosterService";

export async function handleExport(
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

  let csv = "Champion,Stars,Rank,IsAwakened,IsAscended\n";
  roster.forEach((entry) => {
    csv += `"${entry.champion.name}",${entry.stars},${entry.rank},${entry.isAwakened},${entry.isAscended}\n`;
  });

  const attachment = new AttachmentBuilder(Buffer.from(csv), {
    name: `${player.ingameName}-roster.csv`,
  });

  await interaction.editReply({
    content: `Roster for ${player.ingameName} exported.`,
    files: [attachment],
  });
}
