import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { prisma } from "../../services/prismaService";
import { importRosterFromSheet } from "../../services/rosterService";
import { safeReply } from "../../utils/errorHandler";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register your in-game name.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Your in-game name.")
        .setRequired(true)
    ),
  access: CommandAccess.PUBLIC,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const ingameName = interaction.options.getString("name", true);
    const discordId = interaction.user.id;
    const guild = interaction.guild;

    if (!guild) {
      await safeReply(interaction, "This command can only be used in a server.");
      return;
    }

    // Find or create the alliance
    const alliance = await prisma.alliance.upsert({
      where: { guildId: guild.id },
      update: { name: guild.name },
      create: { guildId: guild.id, name: guild.name },
    });

    const player = await prisma.player.upsert({
      where: { discordId },
      update: { ingameName, allianceId: alliance.id },
      create: { discordId, ingameName, allianceId: alliance.id },
    });

    // Import roster from sheet after registration
    await importRosterFromSheet(player.id);

    await safeReply(interaction, `✅ Successfully registered **${player.ingameName}**.`);
  },
};
