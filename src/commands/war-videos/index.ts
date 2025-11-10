import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { prisma } from '../../services/prismaService';
import { config } from '../../config';
import loggerService from '../../services/loggerService';
import crypto from 'crypto';

async function handleUploadSubcommand(interaction: CommandInteraction) {
//...
//...
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.uploadToken.create({
//...

    const uploadUrl = `${config.botBaseUrl}/war-videos/upload?token=${token}`;

    await interaction.editReply({
      content: `Click the link below to upload your Alliance War video. This link is valid for 15 minutes:\n${uploadUrl}`,
    });

    loggerService.info({ discordId, token, expiresAt }, 'Generated upload token for player.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    loggerService.error({ discordId, error: errorMessage, stack: errorStack }, 'Failed to generate upload link for player.');
    await interaction.editReply({
      content: 'An error occurred while generating your upload link. Please try again later.',
    });
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('war-videos')
    .setDescription('Commands for the Alliance War video library.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('upload')
        .setDescription('Generates a link to upload a new Alliance War video.')
    ),
  access: CommandAccess.USER,
  help: {
    group: 'Alliance Tools',
    color: 'gold',
  },
  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'upload') {
      await handleUploadSubcommand(interaction);
    } else {
      await interaction.reply({
        content: 'Unknown subcommand.',
        ephemeral: true,
      });
    }
  },
};
