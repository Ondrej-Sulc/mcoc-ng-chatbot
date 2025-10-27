
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../types/command';
import { handleAllianceConfig } from './config';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alliance')
    .setDescription('Manage your alliance settings.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('config')
        .setDescription('Enable or disable commands for your alliance.')
        .addStringOption((option) =>
          option
            .setName('command')
            .setDescription('The command to configure.')
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Whether the command should be enabled or disabled.')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'config':
        await handleAllianceConfig(interaction);
        break;
    }
  },
};
