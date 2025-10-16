import { ChatInputCommandInteraction, Attachment, MessageFlags } from "discord.js";
import { core as prestigeCore } from "../prestige/core";

export async function handlePrestigeDebug(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const image = interaction.options.getAttachment("image") as Attachment;
  const targetUserId = interaction.options.getString("player") ?? undefined;

  if (!image || !image.url) {
    await interaction.editReply("Image is required.");
    return;
  }

  const result = await prestigeCore({
    userId: interaction.user.id,
    imageUrl: image.url,
    targetUserId,
    debug: true,
    interaction,
  });

  await interaction.editReply({
    content: result.content,
    files: result.files,
    embeds: result.embeds,
    components: result.components,
  });
}
