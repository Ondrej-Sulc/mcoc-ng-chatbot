import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { Command } from '../types/command';
import { championAdminHelper } from '../utils/championAdminHelper';
import { config } from '../config';

const authorizedUsers = config.DEV_USER_IDS || [];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administrative commands.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('champion')
        .setDescription('Admin commands for managing champions.')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Adds a new champion to the database.')
            .addStringOption(option => option.setName('name').setDescription('Full name of the champion.').setRequired(true))
            .addStringOption(option => option.setName('short_name').setDescription('Short name of the champion.').setRequired(true))
            .addStringOption(option =>
              option
                .setName('class')
                .setDescription('Class of the champion.')
                .setRequired(true)
                .addChoices(
                  { name: 'Science', value: 'SCIENCE' },
                  { name: 'Skill', value: 'SKILL' },
                  { name: 'Mystic', value: 'MYSTIC' },
                  { name: 'Cosmic', value: 'COSMIC' },
                  { name: 'Tech', value: 'TECH' },
                  { name: 'Mutant', value: 'MUTANT' },
                  { name: 'Superior', value: 'SUPERIOR' }
                )
            )
            .addStringOption(option => option.setName('tags_image').setDescription('URL of the image with champion tags.').setRequired(true))
            .addStringOption(option => option.setName('primary_image').setDescription('URL of the primary image (portrait).').setRequired(true))
            .addStringOption(option => option.setName('secondary_image').setDescription('URL of the secondary image (featured).').setRequired(true))
            .addStringOption(option => option.setName('release_date').setDescription('Release date of the champion (YYYY-MM-DD).').setRequired(true))
            .addStringOption(option => option.setName('obtainable_range').setDescription('Obtainable star range (e.g., "2-7").').setRequired(false))
            .addIntegerOption(option => option.setName('prestige_6').setDescription('Prestige for 6-star version.').setRequired(false))
            .addIntegerOption(option => option.setName('prestige_7').setDescription('Prestige for 7-star version.').setRequired(false))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('update_images')
            .setDescription('Updates the images for an existing champion.')
            .addStringOption(option => option.setName('name').setDescription('Name of the champion to update.').setRequired(true))
            .addStringOption(option => option.setName('primary_image').setDescription('URL of the new primary image.').setRequired(true))
            .addStringOption(option => option.setName('secondary_image').setDescription('URL of the new secondary image.').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('sync-sheet')
            .setDescription('Syncs the champion database with Google Sheets.')
        )
    ),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (authorizedUsers.length === 0 || !authorizedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You are not authorized to use this command.', flags: MessageFlags.Ephemeral });
        return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'champion') {
      await interaction.deferReply({ ephemeral: true });
      if (subcommand === 'add') {
        await championAdminHelper.addChampion(interaction);
      } else if (subcommand === 'update_images') {
        await championAdminHelper.updateChampionImages(interaction);
      } else if (subcommand === 'sync-sheet') {
        await championAdminHelper.syncSheet(interaction);
      }
    }
  },
};
