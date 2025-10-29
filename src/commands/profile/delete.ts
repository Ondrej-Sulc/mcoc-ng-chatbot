import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, Collection } from "discord.js";
import { prisma } from "../../services/prismaService";

export async function handleDelete(interaction: ChatInputCommandInteraction) {
  const player = await prisma.player.findUnique({
    where: { discordId: interaction.user.id },
  });

  if (!player) {
    await interaction.reply({
      content: "You don't have a profile to delete.",
      ephemeral: true,
    });
    return;
  }

  const confirmId = `profile_delete_confirm_${interaction.user.id}`;
  const cancelId = `profile_delete_cancel_${interaction.user.id}`;

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(confirmId)
        .setLabel("Yes, delete my profile")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelId)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

  const reply = await interaction.reply({
    content: `Are you sure you want to delete your profile? This action is irreversible and will delete all your data, including your roster and prestige history.`,
    components: [row],
    ephemeral: true,
  });

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15000,
  });

  collector.on("collect", async (i: ButtonInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: "This is not for you.", ephemeral: true });
      return;
    }

    collector.stop();

    if (i.customId === confirmId) {
      try {
        await prisma.player.delete({
          where: { id: player.id },
        });
        await i.update({
          content: "Your profile has been successfully deleted.",
          components: [],
        });
      } catch (error) {
        console.error("Error deleting player profile:", error);
        await i.update({
          content: "An error occurred while deleting your profile. Please try again later.",
          components: [],
        });
      }
    } else if (i.customId === cancelId) {
      await i.update({
        content: "Profile deletion cancelled.",
        components: [],
      });
    }
  });

  collector.on("end", (collected: Collection<string, ButtonInteraction>) => {
    if (collected.size === 0) {
      interaction.editReply({
        content: "Profile deletion timed out.",
        components: [],
      });
    }
  });
}