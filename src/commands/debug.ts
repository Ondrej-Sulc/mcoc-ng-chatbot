import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  PermissionFlagsBits,
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "../types/command";
import {
  processRosterScreenshot,
  RosterDebugResult,
} from "../services/rosterService";
import { config } from "../config";
import { createEmojiResolver } from "../utils/emojiResolver";
import {
  core as prestigeCore,
  autocomplete as prestigeAutocomplete,
} from "./prestige";

const authorizedUsers = config.DEV_USER_IDS || [];

async function handleRosterDebug(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const images: Attachment[] = [];
  for (let i = 1; i <= 10; i++) {
    const image = interaction.options.getAttachment(`image${i}`);
    if (image) {
      images.push(image);
    }
  }

  if (images.length === 0) {
    await interaction.editReply("You must provide at least one image.");
    return;
  }

  await interaction.editReply(`Processing ${images.length} image(s)...`);
  const resolveEmojis = createEmojiResolver(interaction.client);

  for (const image of images) {
    // Stars and rank are not needed for debug mode, but the function requires them.
    // Pass dummy values.
    const stars = 0;
    const rank = 0;
    const result = (await processRosterScreenshot(
      image.url,
      stars,
      rank,
      false,
      true
    )) as RosterDebugResult;

    const files: AttachmentBuilder[] = [];
    const container = new ContainerBuilder();

    const title = new TextDisplayBuilder().setContent(
      `### Result for ${image.name}:`
    );
    container.addTextDisplayComponents(title);

    if (result.debugImageBuffer) {
      const attachmentName = `debug_${image.name}`;
      files.push(
        new AttachmentBuilder(result.debugImageBuffer, { name: attachmentName })
      );
      const gallery = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${attachmentName}`)
          .setDescription("Debug Image")
      );
      container.addMediaGalleryComponents(gallery);
    }

    const content = new TextDisplayBuilder().setContent(
      resolveEmojis(result.message)
    );
    container.addTextDisplayComponents(content);

    await interaction.followUp({
      components: [container],
      files,
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }
}

async function handlePrestigeDebug(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const image = interaction.options.getAttachment("image") as Attachment;
  const targetUserId = interaction.options.getString("player") ?? undefined;

  if (!image || !image.url) {
    await interaction.editReply("Image is required.");
    return;
  }

  const result = await prestigeCore({
    userId: interaction.user.id,
    imageUrl: image.url,
    targetUserId,
    debug: true,
    interaction,
  });

  await interaction.editReply({
    content: result.content,
    files: result.files,
    embeds: result.embeds,
    components: result.components,
  });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("debug")
    .setDescription("Debugging commands, restricted access.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("roster")
        .setDescription("Debug roster processing from one or more screenshots.")
        .addAttachmentOption((option) =>
          option
            .setName("image1")
            .setDescription("A screenshot of your champion roster.")
            .setRequired(true)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image2")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image3")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image4")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image5")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image6")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image7")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image8")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image9")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image10")
            .setDescription("Another screenshot.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("prestige")
        .setDescription("Debug prestige extraction from a screenshot.")
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription(
              "Screenshot of MCOC profile showing prestige values."
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("player")
            .setDescription(
              "The player to update prestige for (for debug context)."
            )
            .setRequired(false)
            .setAutocomplete(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (
      authorizedUsers.length === 0 ||
      !authorizedUsers.includes(interaction.user.id)
    ) {
      await interaction.reply({
        content: "You are not authorized to use this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "roster") {
      await handleRosterDebug(interaction);
    } else if (subcommand === "prestige") {
      await handlePrestigeDebug(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "prestige") {
      await prestigeAutocomplete(interaction);
    }
  },
};
