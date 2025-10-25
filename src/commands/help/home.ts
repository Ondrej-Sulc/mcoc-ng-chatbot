import {
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ButtonStyle,
} from "discord.js";
import { CommandResult } from "../../types/command";
import { commandDescriptions, CommandInfo } from "./descriptions";

export const helpColors = {
  buttons: {
    command: ButtonStyle.Secondary,
    navigation: ButtonStyle.Primary,
  },
  containers: {
    home: 0x5865f2, // Discord Blue
    detail: 0x4f545c, // Discord Dark Grey
  },
};

function buildButtonRows(
  commandNames: string[]
): ActionRowBuilder<ButtonBuilder>[] {
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (commandNames.length === 0) return components;

  let actionRow = new ActionRowBuilder<ButtonBuilder>();
  commandNames.forEach((name) => {
    if (actionRow.components.length === 4) {
      components.push(actionRow);
      actionRow = new ActionRowBuilder<ButtonBuilder>();
    }
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`help_command_${name}`)
        .setLabel(name.charAt(0).toUpperCase() + name.slice(1))
        .setStyle(helpColors.buttons.command)
    );
  });
  if (actionRow.components.length > 0) {
    components.push(actionRow);
  }
  return components;
}

export async function handleHome(): Promise<CommandResult> {
  const container = new ContainerBuilder();
  container.setAccentColor(helpColors.containers.home);

  const title = new TextDisplayBuilder().setContent(
    "## MCOC NG Bot Help Center"
  );
  const description = new TextDisplayBuilder().setContent(
    "Welcome! This bot provides a variety of tools for Marvel Contest of Champions. Select a command group below to learn more about its features and subcommands."
  );
  container.addTextDisplayComponents(title, description);

  const groupedCommands: Record<string, string[]> = {
    "Information & Search": [],
    "User Management": [],
    "Alliance Tools": [],
    Utilities: [],
  };
  const adminCommands: string[] = [];

  for (const [name, info] of commandDescriptions.entries()) {
    if (info.category === "Admin") {
      adminCommands.push(name);
    } else if (info.group) {
      groupedCommands[info.group].push(name);
    }
  }

  // General Commands Grouped
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
  );
  const generalHeader = new TextDisplayBuilder().setContent(
    "## General Commands"
  );
  container.addTextDisplayComponents(generalHeader);

  for (const groupName of Object.keys(groupedCommands)) {
    const commandsInGroup = groupedCommands[groupName].sort();
    if (commandsInGroup.length > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      const groupHeader = new TextDisplayBuilder().setContent(
        `### ${groupName}`
      );
      container.addTextDisplayComponents(groupHeader);
      const buttonRows = buildButtonRows(commandsInGroup);
      buttonRows.forEach((row) => container.addActionRowComponents(row));
    }
  }

  // Admin Commands
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
  );
  const adminHeader = new TextDisplayBuilder().setContent("## Admin Commands");
  container.addTextDisplayComponents(adminHeader);
  const adminButtonRows = buildButtonRows(adminCommands.sort());
  adminButtonRows.forEach((row) => container.addActionRowComponents(row));

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
