import { randomBytes } from "crypto";
import { ButtonInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { add } from "date-fns";

export async function handleGenerateUploadLink(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const [_, warId, playerId] = interaction.customId.split(":");

  if (!warId || !playerId) {
    await interaction.editReply("Invalid button ID.");
    return;
  }

  const fights = await prisma.warFight.findMany({
    where: {
      warId: warId,
      playerId: playerId,
      videoId: null, // Only include fights that don't have a video yet
    },
    select: {
      id: true,
    },
  });

  if (fights.length === 0) {
    await interaction.editReply("No fights found for this plan that need a video.");
    return;
  }

  const fightIds = fights.map((f) => f.id);
  const token = randomBytes(32).toString("hex");

  const session = await prisma.uploadSession.create({
    data: {
      token,
      fightIds: fightIds,
      expiresAt: add(new Date(), { hours: 24 }), // Session expires in 24 hours
    },
  });

  const uploadUrl = `${process.env.WEB_URL}/war-videos/upload?session_token=${session.token}`;

  await interaction.editReply(`Here is your unique upload link. It will expire in 24 hours.\n\n${uploadUrl}`);
}