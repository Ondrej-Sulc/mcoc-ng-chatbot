import { ChatInputCommandInteraction, Attachment, MessageFlags } from "discord.js";
import { core } from "./core";

export async function handleUpdate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const image = interaction.options.getAttachment("image") as Attachment;
  const targetUserId = interaction.options.getString("player") ?? undefined;

  if (!image || !image.url) {
    throw new Error("No image provided.");
  }

  const result = await core({
    userId: interaction.user.id,
    imageUrl: image.url,
    targetUserId,
    interaction,
  });

  if (result.isComponentsV2) {
    await interaction.editReply({
      flags: [MessageFlags.IsComponentsV2],
      components: result.components,
    });
  } else {
    await interaction.editReply({
      content: result.content,
      files: result.files,
      embeds: result.embeds,
    });
  }
}
