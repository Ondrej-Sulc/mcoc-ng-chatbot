import { Player } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export function buildPrestigeConfirmationContainer(
  targetPlayer: Player
): ActionRowBuilder<ButtonBuilder> {
  const confirmationButtons =
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prestige:confirm:${targetPlayer.discordId}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`prestige:cancel:${targetPlayer.discordId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

  return confirmationButtons;
}
