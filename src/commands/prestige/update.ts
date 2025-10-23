import { ChatInputCommandInteraction, Attachment, MessageFlags } from "discord.js";
import { updatePrestige } from "./updatePrestige";
import { prisma } from "../../services/prismaService";

export async function handleUpdate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const image = interaction.options.getAttachment("image") as Attachment;
  const targetUserId = interaction.options.getString("player") ?? undefined;

  if (!image || !image.url) {
    throw new Error("No image provided.");
  }

  const player = await prisma.player.findUnique({
    where: { discordId: interaction.user.id },
  });

  if (!player) {
    await interaction.editReply("You are not registered. Please register with /profile register first.");
    return;
  }

  const result = await updatePrestige({
    userId: interaction.user.id,
    imageUrl: image.url,
    targetUserId,
    player,
    debug: false,
  });

  await interaction.editReply(result);
}
