import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { commands } from '../../utils/commandHandler';
import { Command, CommandAccess } from '../../types/command';
import { prisma } from '../../services/prismaService';

export const helpColors = {
  buttons: {
    navigation: ButtonStyle.Primary,
  },
  containers: {
    detail: 0x5865F2, // Discord Blue
  },
};

interface UserAccess {
  isBotAdmin: boolean;
  isAllianceAdmin: boolean;
  isRegistered: boolean;
  enabledFeatureCommands: string[];
}

async function getUserAccess(interaction: ChatInputCommandInteraction): Promise<UserAccess> {
  const player = await prisma.player.findUnique({ where: { discordId: interaction.user.id } });
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  const alliance = interaction.guild ? await prisma.alliance.findUnique({ where: { guildId: interaction.guild.id } }) : null;

  return {
    isBotAdmin: player?.isBotAdmin || false,
    isAllianceAdmin: member?.permissions.has('Administrator') || false,
    isRegistered: !!player,
    enabledFeatureCommands: alliance?.enabledFeatureCommands || [],
  };
}

function hasAccess(command: Command, access: UserAccess): boolean {
  switch (command.access) {
    case CommandAccess.PUBLIC:
      return true;
    case CommandAccess.USER:
      return access.isRegistered;
    case CommandAccess.ALLIANCE_ADMIN:
      return access.isAllianceAdmin;
    case CommandAccess.BOT_ADMIN:
      return access.isBotAdmin;
    case CommandAccess.FEATURE:
      return access.enabledFeatureCommands.includes(command.data.name);
    default:
      return false;
  }
}

export async function handleHome(interaction: ChatInputCommandInteraction) {
  const userAccess = await getUserAccess(interaction);

  const applicationCommands = await interaction.client.application.commands.fetch();
  const commandIds = new Map<string, string>();
  applicationCommands.forEach(cmd => {
    commandIds.set(cmd.name, cmd.id);
  });

  const commandList = Array.from(commands.values());

  const categories: Record<string, Command[]> = {
    'Public': commandList.filter(c => c.access === CommandAccess.PUBLIC),
    'User': commandList.filter(c => c.access === CommandAccess.USER),
    'Alliance Admin': commandList.filter(c => c.access === CommandAccess.ALLIANCE_ADMIN),
    'Bot Admin': commandList.filter(c => c.access === CommandAccess.BOT_ADMIN),
    'Features': commandList.filter(c => c.access === CommandAccess.FEATURE),
  };

  const container = new ContainerBuilder();

  for (const category in categories) {
    if (categories[category].length > 0) {
      const title = new TextDisplayBuilder().setContent(`# ${category} Commands`);
      container.addTextDisplayComponents(title);

      const description = new TextDisplayBuilder().setContent(
        categories[category].map(c => `</${c.data.name}:${commandIds.get(c.data.name)}> - ${c.data.description}`).join('\n')
      );
      container.addTextDisplayComponents(description);

      // Create action rows with a maximum of 5 buttons per row
      const categoryCommands = categories[category];
      for (let i = 0; i < categoryCommands.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        const rowCommands = categoryCommands.slice(i, i + 5);

        rowCommands.forEach(command => {
          const button = new ButtonBuilder()
            .setCustomId(`help:${command.data.name}`)
            .setLabel(command.data.name)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasAccess(command, userAccess));
          row.addComponents(button);
        });
        container.addActionRowComponents(row);
      }
      container.addSeparatorComponents(new SeparatorBuilder());
    }
  }

  return {
    components: [container],
    flags: [MessageFlags.IsComponentsV2],
  };
}