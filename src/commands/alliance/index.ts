import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { handleAllianceToggleFeature } from './toggle-feature';
import { handleAllianceJoin } from './join';

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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join the alliance associated with this server.')
    ),
  access: CommandAccess.USER, // Set base access to USER

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case 'toggle-feature':
        // Manual permission check for ALLIANCE_ADMIN
        const member = interaction.member;
        if (!member || typeof member.permissions === 'string' || !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          await interaction.editReply({ content: 'You must be an administrator to use this command.' });
          return;
        }
        await handleAllianceToggleFeature(interaction);
        break;
      case 'join':
        await handleAllianceJoin(interaction);
        break;
    }
  },
};