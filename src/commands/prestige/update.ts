import { ChatInputCommandInteraction, Attachment } from "discord.js";
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
    debug: false,
  });

  await interaction.editReply(result);
}