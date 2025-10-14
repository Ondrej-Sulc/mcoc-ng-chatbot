import { ChatInputCommandInteraction } from "discord.js";
import { getPlayer } from "../../utils/playerHelper";
import { getRoster } from "../../services/rosterService";
import { setupRosterView, sendRosterPage } from "../../utils/rosterView";

export async function handleView(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();
  const stars = interaction.options.getInteger("stars");
  const rank = interaction.options.getInteger("rank");
  const isAscended = interaction.options.getBoolean("is_ascended");

  const player = await getPlayer(interaction);
  if (!player) {
    return;
  }

  const roster = await getRoster(player.id, stars, rank, isAscended);

  if (typeof roster === "string") {
    await interaction.editReply({ content: roster });
    return;
  }

  const viewId = setupRosterView(roster, player);
  await sendRosterPage(interaction, viewId, 1);
}
