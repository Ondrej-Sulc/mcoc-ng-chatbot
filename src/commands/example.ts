import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { Command, CommandResult } from "../types/command";
import { handleError, safeReply } from "../utils/errorHandler";

/**
 * Core logic for the example command.
 * @param params - Parameters for the command, including the user ID and any options.
 * @returns A promise that resolves to a CommandResult object.
 */
export async function core(params: {
  userId: string;
  text?: string | null;
}): Promise<CommandResult> {
  try {
    const { text } = params;
    const message = `This is an example command. You said: ${
      text || "nothing"
    }`;
    return { content: message };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:example:core",
      userId: params.userId,
    });
    return { content: userMessage };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("example")
    .setDescription("An example command.")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Some text to echo back.")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const text = interaction.options.getString("text");
      const result = await core({
        userId: interaction.user.id,
        text,
      });
      await interaction.editReply({
        content: result.content || "No content to display.",
      });
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: "command:example",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};