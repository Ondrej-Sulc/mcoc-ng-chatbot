import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { config } from "../../config";
import { autocomplete as prestigeAutocomplete } from "../prestige";
import { handleRosterDebug } from "./roster";
import { handlePrestigeDebug } from "./prestige";

const authorizedUsers = config.DEV_USER_IDS || [];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("debug")
    .setDescription("Debugging commands, restricted access.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("roster")
        .setDescription("Debug roster processing from one or more screenshots.")
        .addAttachmentOption((option) =>
          option
            .setName("image1")
            .setDescription("A screenshot of your champion roster.")
            .setRequired(true)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image2")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image3")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image4")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image5")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("prestige")
        .setDescription("Debug prestige extraction from a screenshot.")
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription(
              "Screenshot of MCOC profile showing prestige values."
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player to update prestige for (for debug context)."
            )
            .setRequired(false)
            .setAutocomplete(true)
        )
    ),
  access: CommandAccess.BOT_ADMIN,
  async execute(interaction: ChatInputCommandInteraction) {
    if (
      authorizedUsers.length === 0 ||
      !authorizedUsers.includes(interaction.user.id)
    ) {
      await interaction.reply({
        content: "You are not authorized to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "roster") {
      await handleRosterDebug(interaction);
    } else if (subcommand === "prestige") {
      await handlePrestigeDebug(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "prestige") {
      await prestigeAutocomplete(interaction);
    }
  },
};