import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { prisma } from "../../services/prismaService";
import { handleProfileAdd } from "./add";
import { handleProfileSwitch } from "./switch";
import { handleProfileList } from "./list";
import { handleProfileRemove } from "./remove";
import { handleProfileRename } from "./rename";
import { handleView } from "./view"; // This will need to be refactored
import { handleTimezone } from "./timezone"; // This will need to be refactored

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Manage your in-game profiles.")
    .addSubcommand(subcommand =>
      subcommand
        .setName("add")
        .setDescription("Add a new in-game profile.")
        .addStringOption(option =>
          option.setName("name")
            .setDescription("Your in-game name for the new profile.")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove")
        .setDescription("Remove one of your in-game profiles.")
        .addStringOption(option =>
          option.setName("name")
            .setDescription("The in-game name of the profile to remove.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("rename")
        .setDescription("Rename one of your in-game profiles.")
        .addStringOption(option =>
          option.setName("current_name")
            .setDescription("The current name of the profile to rename.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName("new_name")
            .setDescription("The new name for the profile.")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("switch")
        .setDescription("Switch your active in-game profile.")
        .addStringOption(option =>
          option.setName("name")
            .setDescription("The in-game name of the profile to switch to.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("List all of your in-game profiles.")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("view")
            .setDescription("View a player's active profile.")
            .addUserOption(option =>
                option.setName("user")
                    .setDescription("The user to view.")
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("timezone")
            .setDescription("Set your local timezone for your active profile.")
            .addStringOption(option =>
                option
                    .setName("timezone")
                    .setDescription("Your timezone (e.g., America/New_York).")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    ),
  access: CommandAccess.USER,

  help: {
    group: "User Management",
    color: "pink",
    subcommands: {
      view: {
        image: "https://storage.googleapis.com/champion-images/feature-showcase/profile_view.png",
      },
    },
  },

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "add":
        await handleProfileAdd(interaction);
        break;
      case "switch":
        await handleProfileSwitch(interaction);
        break;
      case "list":
        await handleProfileList(interaction);
        break;
      case "remove":
        await handleProfileRemove(interaction);
        break;
      case "rename":
        await handleProfileRename(interaction);
        break;
      case "view":
        await handleView(interaction);
        break;
      case "timezone":
        await handleTimezone(interaction);
        break;
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const discordId = interaction.user.id;

    if (focused.name === 'name' || focused.name === 'current_name') { // For switch, remove, and rename
      const profiles = await prisma.player.findMany({
        where: { discordId },
        select: { ingameName: true },
      });
      const query = focused.value.toLowerCase();
      const filteredProfiles = profiles
        .filter(p => p.ingameName.toLowerCase().includes(query))
        .slice(0, 25);

      await interaction.respond(
        filteredProfiles.map(p => ({ name: p.ingameName, value: p.ingameName }))
      );
    } else if (focused.name === 'timezone') {
      const timezones = Intl.supportedValuesOf('timeZone');
      const query = focused.value.toLowerCase();
      const filteredTimezones = timezones
        .filter(tz => tz.toLowerCase().includes(query))
        .slice(0, 25);
      
      await interaction.respond(
        filteredTimezones.map(tz => ({ name: tz, value: tz }))
      );
    }
  },
};