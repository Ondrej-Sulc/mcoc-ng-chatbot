import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { handleAllianceToggleFeature } from './toggle-feature';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alliance')
    .setDescription('Manage your alliance settings.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle-feature')
        .setDescription('Enable or disable a feature for your alliance.')
        .addStringOption((option) =>
          option
            .setName('feature')
            .setDescription('The feature to toggle.')
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Whether the feature should be enabled or disabled.')
            .setRequired(true)
        )
    ),
  access: CommandAccess.ALLIANCE_ADMIN,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'toggle-feature':
        await handleAllianceToggleFeature(interaction);
        break;
    }
  },
};