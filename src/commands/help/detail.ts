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
} from "discord.js";
import { CommandResult } from "../../types/command";
import { commandDescriptions, SubcommandInfo } from "./descriptions";
import { helpColors } from "./home";

export async function handleDetail(name: string): Promise<CommandResult> {
  const commandInfo = commandDescriptions.get(name);

  const container = new ContainerBuilder();
  container.setAccentColor(helpColors.containers.detail);

  if (!commandInfo) {
    const notFound = new TextDisplayBuilder().setContent(
      `Command "${name}" not found.`
    );
    container.addTextDisplayComponents(notFound);
    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    };
  }

  const title = new TextDisplayBuilder().setContent(`# /${name}`);
  container.addTextDisplayComponents(title);

  const description = new TextDisplayBuilder().setContent(
    `*${commandInfo.description}*`
  );
  container.addTextDisplayComponents(description);

  if (commandInfo.subcommands.size > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );

    let isFirstSubcommand = true; // Flag to avoid adding separator before the first subcommand
    for (const [subName, subInfo] of commandInfo.subcommands) {
      if (!isFirstSubcommand) {
        container.addSeparatorComponents(new SeparatorBuilder()); // Separator between subcommands
      }
      isFirstSubcommand = false;

      let subcommandContent = `## \`/${name} ${subName}\`\n*${subInfo.description}*`; // Changed to H3 and added description here

      if (subInfo.usage) {
        subcommandContent += `\n- **Usage:** \`${subInfo.usage}\``; // Bullet point and code block for usage
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
          subcommandContent += `\n  - \`${example}\``; // Bullet point and code block for examples
        }
      }

      const subcommandDisplay = new TextDisplayBuilder().setContent(
        subcommandContent
      );
      container.addTextDisplayComponents(subcommandDisplay);

      // Add image rendering here
      if (subInfo.image) {
        const imageGallery = new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(subInfo.image)
        );
        container.addMediaGalleryComponents(imageGallery);
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

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
