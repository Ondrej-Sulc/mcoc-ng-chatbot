import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  AttachmentBuilder,
} from "discord.js";
import { Command } from "../types/command";
import { handleError } from "../utils/errorHandler";
import { processRosterScreenshot, RosterDebugResult } from "../services/rosterService";
import { config } from '../config';

const authorizedUsers = config.DEV_USER_IDS?.split(',') || [];

async function handleRosterDebug(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const images: Attachment[] = [];
  for (let i = 1; i <= 10; i++) {
    const image = interaction.options.getAttachment(`image${i}`);
    if (image) {
      images.push(image);
    }
  }

  if (images.length === 0) {
    await interaction.editReply('You must provide at least one image.');
    return;
  }

  await interaction.editReply(`Processing ${images.length} image(s)...`);

  for (const image of images) {
    try {
      // Stars and rank are not needed for debug mode, but the function requires them.
      // Pass dummy values.
      const stars = 0;
      const rank = 0;
      const result = await processRosterScreenshot(image.url, stars, rank, true) as RosterDebugResult;

      const files: AttachmentBuilder[] = [];
      let content = `### Result for ${image.name}:\n`;

      content += result.message;
      // if (result.imageBuffer) {
      //   files.push(new AttachmentBuilder(result.imageBuffer, { name: `base_${image.name}` }));
      // }
      if (result.debugImageBuffer) {
        files.push(new AttachmentBuilder(result.debugImageBuffer, { name: `debug_${image.name}` }));
      }
      
      await interaction.followUp({ content, files, ephemeral: true });

    } catch (error) {
      const { userMessage } = handleError(error, {
        location: "command:debug:roster",
        userId: interaction.user.id,
        extra: { imageName: image.name }
      });
      await interaction.followUp({ content: `### Error processing ${image.name}:\n${userMessage}`, ephemeral: true });
    }
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("debug")
    .setDescription("Debugging commands, restricted access.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("roster")
        .setDescription("Debug roster processing from one or more screenshots.")
        .addAttachmentOption(option => option.setName("image1").setDescription("A screenshot of your champion roster.").setRequired(true))
        .addAttachmentOption(option => option.setName("image2").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image3").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image4").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image5").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image6").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image7").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image8").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image9").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption(option => option.setName("image10").setDescription("Another screenshot.").setRequired(false))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (authorizedUsers.length === 0 || !authorizedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "roster") {
      await handleRosterDebug(interaction);
    }
  },
};
