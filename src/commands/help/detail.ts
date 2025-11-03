import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  MediaGalleryBuilder, // Import MediaGalleryBuilder
  MediaGalleryItemBuilder, // Import MediaGalleryItemBuilder
  ButtonInteraction,
} from "discord.js";
import { CommandAccess, CommandResult } from "../../types/command";
import { commandDescriptions, SubcommandInfo } from "./descriptions";
import { helpColors } from "./home";

function getAccessLevelString(access: CommandAccess): string {
  switch (access) {
    case CommandAccess.PUBLIC:
      return "Public";
    case CommandAccess.USER:
      return "Registered User";
    case CommandAccess.ALLIANCE_ADMIN:
      return "Alliance Admin";
    case CommandAccess.BOT_ADMIN:
      return "Bot Admin";
    case CommandAccess.FEATURE:
      return "Alliance Feature";
  }
}

import { getStyledImagePath } from "../../services/imageStyleService";
import path from "path";

export async function handleDetail(
  name: string,
  interaction: ButtonInteraction
): Promise<void> {
  const commandInfo = commandDescriptions.get(name);

  const applicationCommands = await interaction.client.application.commands.fetch();
  const commandId = applicationCommands.find((cmd) => cmd.name === name)?.id;

  const container = new ContainerBuilder();
  container.setAccentColor(helpColors.containers.detail);

  if (!commandInfo) {
    const notFound = new TextDisplayBuilder().setContent(
      `Command "${name}" not found.`
    );
    container.addTextDisplayComponents(notFound);
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const title = new TextDisplayBuilder().setContent(`# /${name}`);
  container.addTextDisplayComponents(title);

  const accessLevel = new TextDisplayBuilder().setContent(
    `**Access:** ${getAccessLevelString(commandInfo.access)}`
  );
  container.addTextDisplayComponents(accessLevel);

  const description = new TextDisplayBuilder().setContent(
    `*${commandInfo.description}*`
  );
  container.addTextDisplayComponents(description);

  const filesToAttach: string[] = [];

  if (commandInfo.subcommands.size > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );

    let isFirstSubcommand = true;
    for (const [subName, subInfo] of commandInfo.subcommands) {
      if (!isFirstSubcommand) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
      isFirstSubcommand = false;

      const subCommandMention = commandId
        ? `</${name} ${subName}:${commandId}>`
        : `\`/${name} ${subName}\``;
      let subcommandContent = `## ${subCommandMention}\n*${subInfo.description}*`;

      if (subInfo.usage) {
        subcommandContent += `\n- **Usage:** \`${subInfo.usage}\``;
      }

      if (subInfo.filters && subInfo.filters.size > 0) {
        subcommandContent += `\n- **Filters:**`;
        for (const [filterName, filterDesc] of subInfo.filters) {
          subcommandContent += `\n  - \`${filterName}\`: ${filterDesc}`;
        }
      }

      if (subInfo.andOrLogic) {
        subcommandContent += `\n- **AND/OR Logic:** ${subInfo.andOrLogic}`;
      }

      if (subInfo.examples && subInfo.examples.length > 0) {
        subcommandContent += `\n- **Examples:**`;
        for (const example of subInfo.examples) {
          subcommandContent += `\n  - \`${example}\``;
        }
      }

      const subcommandDisplay = new TextDisplayBuilder().setContent(
        subcommandContent
      );
      container.addTextDisplayComponents(subcommandDisplay);

      if (subInfo.image) {
        const styledImagePath = await getStyledImagePath(subInfo.image);
        if (styledImagePath) {
          const filename = path.basename(styledImagePath);
          const imageGallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${filename}`)
          );
          container.addMediaGalleryComponents(imageGallery);
          filesToAttach.push(styledImagePath);
        } else {
          const imageGallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(subInfo.image)
          );
          container.addMediaGalleryComponents(imageGallery);
        }
      }
    }
  }

  const backButton = new ButtonBuilder()
    .setCustomId("help_home")
    .setLabel("Back to Command List")
    .setStyle(helpColors.buttons.navigation);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
  );
  container.addActionRowComponents(row);

  await interaction.editReply({
    components: [container],
    files: filesToAttach,
  });
}