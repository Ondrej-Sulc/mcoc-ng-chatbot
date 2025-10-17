import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ButtonStyle,
} from "discord.js";

export const glossaryColors = {
    buttons: {
        category: ButtonStyle.Primary,
        effect: ButtonStyle.Success,
        navigation: ButtonStyle.Secondary,
    },
    containers: {
        list: 0x5865F2, // Discord Blue
        category: 0x57F287, // Discord Green
        effect: 0xFEE75C, // Discord Yellow
    }
};
import { Command } from "../../types/command";
import { handleAutocomplete } from "./autocomplete";
import { handleEffect } from "./effect";
import { handleCategory } from "./category";
import { handleList } from "./list";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { registerGlossaryButtons } from "./buttons";

registerGlossaryButtons();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("glossary")
    .setDescription("Look up MCOC effects, buffs, and debuffs.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("effect")
        .setDescription("Look up a specific effect by name.")
        .addStringOption((option) =>
          option
            .setName("effect")
            .setDescription("The name of the effect.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("category")
        .setDescription("List all effects within a given category.")
        .addStringOption((option) =>
          option
            .setName("category")
            .setDescription("The name of the category.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all effect categories.")
    ),
  autocomplete: handleAutocomplete,
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const subcommand = interaction.options.getSubcommand();
    const resolveEmoji = createEmojiResolver(interaction.client);
    let result;

    if (subcommand === "list") {
      result = await handleList(resolveEmoji);
    } else {
      const name = interaction.options.getString(subcommand);
      if (!name) {
        await interaction.editReply({ content: "You must provide a name." });
        return;
      }

      if (subcommand === "effect") {
        result = await handleEffect(name, resolveEmoji);
      } else if (subcommand === "category") {
        result = await handleCategory(name, resolveEmoji);
      }
    }

    if (!result) {
      result = {
        content: "Invalid subcommand.",
        flags: MessageFlags.Ephemeral,
      };
    }

    if (result.embeds) {
        await interaction.editReply({
            content: result.content || "",
            embeds: result.embeds,
            components: result.components || [],
        });
    } else if (result.components) {
        await interaction.editReply({
            content: result.content || "",
            components: result.components,
            flags: result.flags,
        });
    } else if (result.content) {
        await interaction.editReply({ content: result.content });
    }
  },
};

export default command;