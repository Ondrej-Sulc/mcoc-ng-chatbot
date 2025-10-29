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

    const existingPlayer = await prisma.player.findUnique({
      where: { discordId },
    });

    if (existingPlayer) {
      await safeReply(
        interaction,
        "You are already registered. To change your name, please use the `/profile name` command."
      );
      return;
    }

    const guild = interaction.guild;
    let allianceId: string | null = null;

    if (guild) {
      const alliance = await prisma.alliance.upsert({
        where: { guildId: guild.id },
        update: { name: guild.name },
        create: { guildId: guild.id, name: guild.name },
      });
      allianceId = alliance.id;
    }

    const player = await prisma.player.create({
      data: {
        discordId,
        ingameName,
        allianceId,
      },
    });

    // Import roster from sheet after registration
    await importRosterFromSheet(player.id);

    let replyMessage = `✅ Successfully registered **${player.ingameName}**.`;
    if (!guild) {
      replyMessage +=
        "\n\nYou can join an alliance by using the `/alliance join` command in your alliance's server.";
    }

    await safeReply(interaction, replyMessage);
  },
};
