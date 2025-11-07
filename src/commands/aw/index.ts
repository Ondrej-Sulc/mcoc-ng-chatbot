import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handlePlan } from "./plan";
import { handleDetails } from "./details";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aw")
    .setDescription("Commands for Alliance War planning and details.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("plan")
        .setDescription("Sends AW plan details from sheet to player threads.")
        .addIntegerOption((option) =>
          option
            .setName("battlegroup")
            .setDescription("The battlegroup to send the plan for.")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("A specific player to send the plan to.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription("An image to send along with the plan.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("details")
        .setDescription("Get detailed information about your AW assignments.")
        .addStringOption((option) =>
          option
            .setName("node")
            .setDescription("A specific node to get details for.")
            .setRequired(false)
        )
    ),
  access: CommandAccess.FEATURE,
  help: {
    group: "Alliance Tools",
    color: "sky",
  },
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "plan":
        await handlePlan(interaction);
        break;
      case "details":
        await handleDetails(interaction);
        break;
    }
  },
};