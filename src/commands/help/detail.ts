import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ButtonInteraction,
  ApplicationCommandOptionType,
} from "discord.js";
import { CommandAccess } from "../../types/command";
import { helpColors } from "./home";
import { getStyledImagePath } from "../../services/imageStyleService";
import path from "path";
import fs from "fs";

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

export async function handleDetail(
  name: string,
  interaction: ButtonInteraction
): Promise<void> {
  const commandDocsPath = path.resolve(__dirname, '../../../src/data/commands.json');
  const commandDocs = JSON.parse(fs.readFileSync(commandDocsPath, 'utf-8'));
  const commandInfo = commandDocs.find((cmd: any) => cmd.name === name);

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

  const subcommands = commandInfo.options.filter(
    (opt: any) =>
      opt.type === ApplicationCommandOptionType.Subcommand ||
      opt.type === ApplicationCommandOptionType.SubcommandGroup
  );

  if (subcommands.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large)
    );

    for (const [index, sub] of subcommands.entries()) {
      if (index > 0) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }

      const subCommandMention = commandId
        ? `</${name} ${sub.name}:${commandId}>`
        : `\`/${name} ${sub.name}\``;

      let subcommandContent = `## ${subCommandMention}\n*${sub.description}*`;

      const subHelp = commandInfo.subcommands?.[sub.name];

      const subcommandDisplay = new TextDisplayBuilder().setContent(subcommandContent);
      container.addTextDisplayComponents(subcommandDisplay);

      if (subHelp?.image) {
        const styledImagePath = await getStyledImagePath(subHelp.image);
        if (styledImagePath) {
          const filename = path.basename(styledImagePath);
          const imageGallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${filename}`)
          );
          container.addMediaGalleryComponents(imageGallery);
          filesToAttach.push(styledImagePath);
        } else {
          const imageGallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(subHelp.image)
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