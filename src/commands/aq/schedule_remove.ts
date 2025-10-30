import { ChatInputCommandInteraction, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, StringSelectMenuInteraction, ButtonBuilder, ButtonStyle, ButtonInteraction, ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { prisma } from "../../services/prismaService";
import { safeReply } from "../../utils/errorHandler";

export async function handleAqScheduleRemove(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
    include: { aqSchedules: true },
  });

  if (!alliance || !alliance.aqSchedules || alliance.aqSchedules.length === 0) {
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent("No AQ schedule found for this alliance."));
    await interaction.editReply({ components: [container], flags: [MessageFlags.IsComponentsV2] });
    return;
  }

  const scheduleOptions = alliance.aqSchedules.map(s => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day = days[s.dayOfWeek];
    return {
      label: `BG${s.battlegroup} - ${day} ${s.time} UTC - Day ${s.aqDay}`,
      description: `in #${s.channelId} tagging @${s.roleId}`,
      value: s.id,
      default: false, // Initialize default to false
    }
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('remove-aq-schedule-select')
    .setPlaceholder('Select a schedule to remove')
    .addOptions(scheduleOptions);

  const confirmButton = new ButtonBuilder()
    .setCustomId('remove-aq-schedule-confirm')
    .setLabel('Confirm')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(true);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Select an AQ schedule entry to remove:"))
    .addActionRowComponents(row)
    .addActionRowComponents(buttonRow);

  const message = await interaction.editReply({ components: [container], flags: [MessageFlags.IsComponentsV2] });

  const collector = message.createMessageComponentCollector({
    time: 60000, // 60 seconds
  });

  let selectedScheduleId: string | null = null;

  collector.on('collect', async (i: StringSelectMenuInteraction | ButtonInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: "You cannot use this menu.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    if (i.isStringSelectMenu()) {
      selectedScheduleId = i.values[0];
      confirmButton.setDisabled(false);

      // Create a new select menu with the selected option marked as default
      const updatedScheduleOptions = scheduleOptions.map(option => ({
        ...option,
        default: option.value === selectedScheduleId,
      }));

      const updatedSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('remove-aq-schedule-select')
        .setPlaceholder('Select a schedule to remove')
        .addOptions(updatedScheduleOptions);

      const updatedRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedSelectMenu);
      const updatedButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton);
      const updatedContainer = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Select an AQ schedule entry to remove:"))
        .addActionRowComponents(updatedRow)
        .addActionRowComponents(updatedButtonRow);
      await i.update({ components: [updatedContainer], flags: [MessageFlags.IsComponentsV2] });
    } else if (i.isButton()) {
      // Defer the update immediately to acknowledge the interaction
      await i.deferUpdate();
      if (selectedScheduleId) {
        try {
          await prisma.aQSchedule.delete({
            where: { id: selectedScheduleId },
          });
          const updatedContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent("AQ schedule entry removed successfully."));
          await i.editReply({ components: [updatedContainer], flags: [MessageFlags.IsComponentsV2] });
        } catch (error) {
          const updatedContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent("Failed to remove AQ schedule entry."));
          await i.editReply({ components: [updatedContainer], flags: [MessageFlags.IsComponentsV2] });
        }
      }
    }
  });

  collector.on('end', async collected => {
    // Disable all components when the collector ends to prevent further interactions
    const disabledSelectMenu = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
    const disabledConfirmButton = ButtonBuilder.from(confirmButton).setDisabled(true);
    const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledSelectMenu);
    const disabledButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledConfirmButton);

    const finalContainer = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("You did not make a selection or the interaction timed out."))
      .addActionRowComponents(disabledRow)
      .addActionRowComponents(disabledButtonRow);

    // Only edit the reply if it hasn't been edited already by a successful deletion
    if (message.editable && !collected.size) {
      await interaction.editReply({ components: [finalContainer], flags: [MessageFlags.IsComponentsV2] });
    }
  });
}