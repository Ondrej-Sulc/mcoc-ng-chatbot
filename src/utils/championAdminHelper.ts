import {
  CommandInteraction,
  GuildEmoji,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  AutocompleteInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
import { gcpStorageService } from "../services/gcpStorageService";
import {
  openRouterService,
  OpenRouterMessage,
} from "../services/openRouterService";
import { PrismaClient, ChampionClass, AbilityLinkType } from "@prisma/client";
import { config } from "../config";
import logger from "../services/loggerService";
import { sheetsService } from "../services/sheetsService";
import { getChampionImageUrl } from "./championHelper";
import { _buildDraftContainer, pendingDrafts } from "./championAbilityDraftHandler";
import { registerModalHandler } from "./modalHandlerRegistry";
import { registerButtonHandler } from "./buttonHandlerRegistry";

const prisma = new PrismaClient();
const pendingChampions = new Map<string, any>();

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image from ${url}: ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

class ChampionAdminHelper {
  async showChampionModalPart1(interaction: CommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId("addChampionModalPart1")
      .setTitle("Add New Champion (Part 1/2)");

    const nameInput = new TextInputBuilder()
      .setCustomId("championName")
      .setLabel("Full Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const shortNameInput = new TextInputBuilder()
      .setCustomId("championShortName")
      .setLabel("Short Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const classInput = new TextInputBuilder()
      .setCustomId("championClass")
      .setLabel("Class (Science, Skill, etc.)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const primaryImageInput = new TextInputBuilder()
      .setCustomId("championPrimaryImage")
      .setLabel("Primary Image URL (Portrait)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const secondaryImageInput = new TextInputBuilder()
      .setCustomId("championSecondaryImage")
      .setLabel("Secondary Image URL (Featured)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(shortNameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(classInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(primaryImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        secondaryImageInput
      )
    );

    await interaction.showModal(modal);
  }

  async showChampionModalPart2(
    interaction: CommandInteraction | ButtonInteraction
  ) {
    const modal = new ModalBuilder()
      .setCustomId("addChampionModalPart2")
      .setTitle("Add New Champion (Part 2/2)");

    const tagsImageInput = new TextInputBuilder()
      .setCustomId("championTagsImage")
      .setLabel("Tags Image URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const heroImageInput = new TextInputBuilder()
      .setCustomId("championHeroImage")
      .setLabel("Hero Image URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const releaseDateInput = new TextInputBuilder()
      .setCustomId("championReleaseDate")
      .setLabel("Release Date (YYYY-MM-DD)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const obtainableRangeInput = new TextInputBuilder()
      .setCustomId("championObtainableRange")
      .setLabel('Obtainable Range (e.g., "2-7")')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue("2-7");

    const prestigeInput = new TextInputBuilder()
      .setCustomId("championPrestige")
      .setLabel("6*,7* Prestige (e.g., 12345,13456)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue("0,0");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(tagsImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(heroImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(releaseDateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        obtainableRangeInput
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(prestigeInput)
    );

    await interaction.showModal(modal);
  }

  async handleChampionModalPart1(interaction: ModalSubmitInteraction) {
    if (!interaction.isModalSubmit()) return;

    try {
      await interaction.deferUpdate();

      const name = interaction.fields.getTextInputValue("championName");
      const shortName =
        interaction.fields.getTextInputValue("championShortName");
      const champClass = interaction.fields
        .getTextInputValue("championClass")
        .toUpperCase() as ChampionClass;
      const primaryImageUrl = interaction.fields.getTextInputValue(
        "championPrimaryImage"
      );
      const secondaryImageUrl = interaction.fields.getTextInputValue(
        "championSecondaryImage"
      );

      const partialChampionData = {
        name,
        shortName,
        champClass,
        primaryImageUrl,
        secondaryImageUrl,
      };

      pendingChampions.set(interaction.user.id, partialChampionData);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("champion-add-part2")
          .setLabel("Continue")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.followUp({
        content:
          "Part 1 of champion creation complete. Click continue to proceed to Part 2.",
        components: [row],
        ephemeral: true,
      });
    } catch (error) {
      logger.error(error, "Error handling champion modal submission part 1");
      await interaction.followUp({
        content: `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        ephemeral: true,
      });
    }
  }

  async handleChampionModalPart2(interaction: ModalSubmitInteraction) {
    if (!interaction.isModalSubmit()) return;

    try {
      await interaction.reply({
        content: "Processing part 2...",
        ephemeral: true,
      });

      const partialChampionData = pendingChampions.get(interaction.user.id);
      if (!partialChampionData) {
        throw new Error(
          "Could not find partial champion data. Please start over."
        );
      }

      const tagsImageUrl =
        interaction.fields.getTextInputValue("championTagsImage");
      const heroImageUrl =
        interaction.fields.getTextInputValue("championHeroImage");
      const releaseDate = interaction.fields.getTextInputValue(
        "championReleaseDate"
      );
      const obtainableRange =
        interaction.fields.getTextInputValue("championObtainableRange") ||
        "2-7";

      const prestigeString =
        interaction.fields.getTextInputValue("championPrestige") || "0,0";
      const [prestige6String, prestige7String] = prestigeString
        .split(",")
        .map((s) => s.trim());

      const prestige6 = parseInt(prestige6String, 10);
      if (isNaN(prestige6)) {
        throw new Error(
          `Invalid number for 6-Star Prestige: ${prestige6String}`
        );
      }

      const prestige7 = parseInt(prestige7String || "0", 10);
      if (isNaN(prestige7)) {
        throw new Error(
          `Invalid number for 7-Star Prestige: ${prestige7String}`
        );
      }

      if (
        !Object.values(ChampionClass).includes(
          partialChampionData.champClass as ChampionClass
        )
      ) {
        throw new Error(
          `Invalid champion class: ${
            partialChampionData.champClass
          }. Please use one of: ${Object.values(ChampionClass).join(", ")}`
        );
      }

      const championData = {
        ...partialChampionData,
        tagsImageUrl,
        heroImageUrl,
        obtainableRange,
        prestige6,
        prestige7,
        releaseDate: new Date(releaseDate),
      };

      await this.addChampion(interaction, championData);

      pendingChampions.delete(interaction.user.id);
    } catch (error) {
      logger.error(error, "Error handling champion modal submission part 2");
      await interaction.followUp({
        content: `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        ephemeral: true,
      });
    }
  }

  async addChampion(
    interaction: CommandInteraction | ModalSubmitInteraction,
    championData: any
  ) {
    logger.info(`Starting champion add process for ${interaction.user.tag}`);

    try {
      await interaction.editReply("Starting champion creation process...");

      const {
        name,
        shortName,
        champClass,
        tagsImageUrl,
        primaryImageUrl,
        secondaryImageUrl,
        heroImageUrl,
        releaseDate,
        obtainableRange,
        prestige6,
        prestige7,
      } = championData;

      logger.info(`Adding champion: ${name}`);

      // 1. Process and upload images
      await interaction.editReply("Processing and uploading images...");
      logger.info("Processing and uploading images...");
      const imageUrls = await this._processAndUploadImages(
        name,
        primaryImageUrl,
        secondaryImageUrl,
        heroImageUrl
      );
      logger.info("Image processing complete.");

      // 2. Process tags
      await interaction.editReply("Processing tags...");
      logger.info("Processing tags...");
      const tags = await this._processTags(tagsImageUrl);
      logger.info("Tag processing complete.");

      // 3. Create Discord Emoji
      await interaction.editReply("Creating Discord emoji...");
      logger.info("Creating Discord emoji...");
      const emoji = await this._createDiscordEmoji(
        interaction,
        shortName,
        imageUrls.p_128
      );
      logger.info(`Emoji created: ${emoji?.name}`);

      // 4. Save to Database
      await interaction.editReply("Saving champion to database...");
      logger.info("Saving champion to database...");
      await this._saveChampionToDb(
        name,
        shortName,
        champClass,
        releaseDate,
        obtainableRange,
        prestige6,
        prestige7,
        imageUrls,
        tags,
        emoji
      );
      logger.info("Champion saved to database.");

      await interaction.editReply(
        `Champion **${name}** created or updated successfully!`
      );
      logger.info(`Champion add process complete for ${name}`);
    } catch (error) {
      logger.error(error, "An error occurred during champion creation");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateChampionImages(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion image update process for ${interaction.user.tag}`
    );

    try {
      await interaction.editReply("Starting image update process...");

      const name = interaction.options.getString("name", true);
      const primaryImageUrl = interaction.options.getString("primary_image");
      const secondaryImageUrl =
        interaction.options.getString("secondary_image");
      const heroImageUrl = interaction.options.getString("hero_image");

      logger.info(`Updating images for champion: ${name}`);

      const champion = await prisma.champion.findUnique({
        where: { name },
      });

      if (!champion) {
        await interaction.editReply(`Champion **${name}** not found.`);
        logger.warn(`Champion not found for image update: ${name}`);
        return;
      }

      const images = champion.images as any;
      const existingPrimary = getChampionImageUrl(images, "full", "primary");
      const existingSecondary = getChampionImageUrl(
        images,
        "full",
        "secondary"
      );

      await interaction.editReply("Processing and uploading new images...");
      logger.info("Processing and uploading new images...");
      const imageUrls = await this._processAndUploadImages(
        name,
        primaryImageUrl || existingPrimary,
        secondaryImageUrl || existingSecondary,
        heroImageUrl
      );
      logger.info("Image processing complete.");

      const newImages = { ...images, ...imageUrls };
      let newEmoji = null;

      if (primaryImageUrl) {
        logger.info("Primary image updated, starting emoji update process...");
        const { client } = interaction;
        const app = await client.application?.fetch();
        if (app?.id) {
          if (champion.discordEmoji) {
            const emojiId = champion.discordEmoji
              .split(":")[2]
              .replace(">", "");
            try {
              await client.rest.delete(
                Routes.applicationEmoji(app.id, emojiId)
              );
              logger.info(`Deleted old emoji with id ${emojiId}`);
            } catch (error) {
              logger.error(
                error,
                `Failed to delete old emoji with id ${emojiId}`
              );
              // Continue even if deletion fails, maybe it was already deleted
            }
          }
          newEmoji = await this._createDiscordEmoji(
            interaction,
            champion.shortName,
            imageUrls.p_128
          );
          logger.info(`Created new emoji: ${newEmoji?.name}`);
        } else {
          logger.warn("Could not fetch application id for emoji update");
        }
      }

      const updateData: any = { images: newImages };
      if (newEmoji) {
        updateData.discordEmoji = `<:${newEmoji.name}:${newEmoji.id}>`;
      }

      await prisma.champion.update({
        where: { id: champion.id },
        data: updateData,
      });
      logger.info("Champion images and emoji updated in database.");

      await interaction.editReply(
        `Images for **${name}** updated successfully!`
      );
      logger.info(`Champion image update process complete for ${name}`);
    } catch (error) {
      logger.error(error, "An error occurred during champion image update");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateChampionTags(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion tags update process for ${interaction.user.tag}`
    );

    try {
      await interaction.editReply("Starting tags update process...");

      const name = interaction.options.getString("name", true);
      const tagsImageUrl = interaction.options.getString("tags_image", true);

      logger.info(`Updating tags for champion: ${name}`);

      const champion = await prisma.champion.findUnique({
        where: { name },
      });

      if (!champion) {
        await interaction.editReply(`Champion **${name}** not found.`);
        logger.warn(`Champion not found for tags update: ${name}`);
        return;
      }

      await interaction.editReply("Processing new tags...");
      logger.info("Processing new tags...");
      const tags = await this._processTags(tagsImageUrl);
      logger.info("Tag processing complete.");

      await interaction.editReply("Updating tags in database...");
      logger.info("Updating tags in database...");

      await prisma.$transaction(async (tx) => {
        const tagConnections = [];
        for (const category in tags) {
          if (category === "All") continue;
          for (const tagName of tags[category]) {
            const tag = await tx.tag.upsert({
              where: { name_category: { name: tagName, category } },
              update: {},
              create: { name: tagName, category },
            });
            tagConnections.push({ id: tag.id });
          }
        }
        logger.info(`Upserted ${tagConnections.length} tags`);

        await tx.champion.update({
          where: { id: champion.id },
          data: {
            tags: {
              set: tagConnections,
            },
          },
        });
        logger.info(`Connected tags to champion ${champion.name}`);
      });

      await interaction.editReply(`Tags for **${name}** updated successfully!`);
      logger.info(`Champion tags update process complete for ${name}`);
    } catch (error) {
      logger.error(error, "An error occurred during champion tags update");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  private async _processAndUploadImages(
    championName: string,
    primaryUrl: string | null,
    secondaryUrl: string | null,
    heroUrl: string | null
  ) {
    logger.info(`_processAndUploadImages for ${championName}`);
    const formattedName = championName
      .replace(/ /g, "_")
      .replace(/\(|\)|'|\./g, "")
      .toLowerCase();
    const tempDir = path.join(os.tmpdir(), "mcoc-ng-chatbot-images");
    await fs.mkdir(tempDir, { recursive: true });

    const imageUrls: any = {};

    // Process hero image
    if (heroUrl) {
      const heroImgBuffer = await downloadImage(heroUrl);
      const heroPath = path.join(tempDir, `${formattedName}_hero.png`);
      await fs.writeFile(heroPath, heroImgBuffer);
      const gcsHeroPath = `hero/${formattedName}.png`;
      imageUrls.hero = await gcpStorageService.uploadFile(
        heroPath,
        gcsHeroPath
      );
      logger.info(`Uploaded ${gcsHeroPath}`);
    }

    for (const type of ["primary", "secondary"]) {
      const url = type === "primary" ? primaryUrl : secondaryUrl;
      if (url) {
        const imgBuffer = await downloadImage(url);
        const typePrefix = type.charAt(0);

        const originalSize = 256;
        const originalPath = path.join(
          tempDir,
          `${formattedName}_${type}_${originalSize}.png`
        );
        await sharp(imgBuffer)
          .resize(originalSize, originalSize)
          .toFile(originalPath);
        const gcsOriginalPath = `${originalSize}/${formattedName}_${type}.png`;
        const key = `full_${type}`;
        imageUrls[key] = await gcpStorageService.uploadFile(
          originalPath,
          gcsOriginalPath
        );
        logger.info(`Uploaded ${gcsOriginalPath}`);

        const blurredImg = sharp(imgBuffer).blur(0.5);

        for (const size of [128, 64, 32]) {
          const resizedPath = path.join(
            tempDir,
            `${formattedName}_${type}_${size}.png`
          );
          await blurredImg.clone().resize(size, size).toFile(resizedPath);
          const gcsResizedPath = `${size}/${formattedName}_${type}.png`;
          const key = `${typePrefix}_${size}`;
          imageUrls[key] = await gcpStorageService.uploadFile(
            resizedPath,
            gcsResizedPath
          );
          logger.info(`Uploaded ${gcsResizedPath}`);
        }
      }
    }

    await fs.rm(tempDir, { recursive: true, force: true });
    return imageUrls;
  }

  private async _processTags(imageUrl: string): Promise<any> {
    logger.info(`_processTags for ${imageUrl}`);
    const imgBuffer = await downloadImage(imageUrl);
    const metadata = await sharp(imgBuffer).metadata();

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    const croppedImageBuffer = await sharp(imgBuffer)
      .extract({
        left: Math.floor(width * 0.25),
        top: Math.floor(height * 0.1),
        width: Math.floor(width * 0.45),
        height: Math.floor(height * 0.8),
      })
      .toBuffer();

    const base64Image = croppedImageBuffer.toString("base64");

    const system_message: OpenRouterMessage = {
      role: "system",
      content: [
        {
          type: "text",
          text: 'Extract information from the image and fill in the following JSON structure, keep all the tag groups even if empty, include # with the tag values, omit \'No Tags\' and leave an empty list value instead:\n          "Combat Style": ["string"],\n          "Attributes": ["string"],\n          "Organization": ["string"],\n          "Alliance Wars": ["string"],\n          "Carina\'s Challenges": ["string"],\n          "Alliance Quest": ["string"],\n          "Release Date": ["string"],\n          "Saga": ["string"]\n',
        },
      ],
    };

    const user_message: OpenRouterMessage = {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
      ],
    };

    logger.info("Sending image to OpenRouter for tag extraction...");
    const response = await openRouterService.chat({
      model: "openai/gpt-4o",
      messages: [system_message, user_message],
      response_format: { type: "json_object" },
    });

    const tags = JSON.parse(response.choices[0].message.content);
    logger.info({ tags }, "Received tags from OpenRouter");
    const allTags = Object.values(tags).flat();
    tags["All"] = [...new Set(allTags)].sort();

    return tags;
  }

  private async _createDiscordEmoji(
    interaction: CommandInteraction | ModalSubmitInteraction,
    championShortName: string,
    imageUrl: string
  ): Promise<any | undefined> {
    logger.info(`_createDiscordEmoji for ${championShortName}`);
    const { client } = interaction;
    const app = await client.application?.fetch();
    if (!app?.id) {
      logger.warn("Could not fetch application id for emoji creation");
      return;
    }

    const cleanName = championShortName.replace(/[^a-zA-Z0-9]/g, "");
    let emojiName = cleanName.substring(0, 3).toLowerCase();

    const emojisResponse = (await client.rest.get(
      Routes.applicationEmojis(app.id)
    )) as any;

    const existingEmojis: any[] = Array.isArray(emojisResponse)
      ? emojisResponse
      : Array.isArray(emojisResponse?.items)
      ? emojisResponse.items
      : Array.isArray(emojisResponse?.emojis)
      ? emojisResponse.emojis
      : [];

    const existingEmojiNames = new Set(existingEmojis.map((e) => e.name));

    let i = 1;
    while (existingEmojiNames.has(emojiName)) {
      if (cleanName.length >= 3) {
        emojiName = `${cleanName.substring(0, 2)}${cleanName.charAt(
          i % cleanName.length
        )}`.toLowerCase();
      } else {
        emojiName = `${cleanName}${i}`.toLowerCase();
      }
      i++;
      if (i > 100) {
        // safety break
        logger.error(
          "Could not generate a unique emoji name after 100 attempts"
        );
        throw new Error("Could not generate a unique emoji name.");
      }
    }
    logger.info(`Generated unique emoji name: ${emojiName}`);

    const imageBuffer = await downloadImage(imageUrl);
    const base64Image = imageBuffer.toString("base64");

    const emoji = await client.rest.post(Routes.applicationEmojis(app.id), {
      body: {
        name: emojiName,
        image: `data:image/png;base64,${base64Image}`,
      },
    });
    logger.info({ emoji }, "Created new application emoji");

    return emoji;
  }

  private async _saveChampionToDb(
    name: string,
    shortName: string,
    champClass: ChampionClass,
    releaseDate: string,
    obtainableRange: string,
    prestige6: number,
    prestige7: number,
    imageUrls: any,
    tags: any,
    emoji: any | undefined
  ) {
    logger.info(`_saveChampionToDb for ${name}`);
    const [start, end] = obtainableRange.split("-").map(Number);
    const obtainable = Array.from({ length: end - start + 1 }, (_, i) =>
      (start + i).toString()
    );

    const prestige = {
      "6": prestige6,
      "7": prestige7,
    };

    const discordEmoji = emoji ? `<:${emoji.name}:${emoji.id}>` : undefined;

    const championData = {
      name,
      shortName,
      class: champClass,
      releaseDate: new Date(releaseDate),
      obtainable,
      prestige,
      images: imageUrls,
      discordEmoji,
      fullAbilities: {},
    };

    await prisma.$transaction(async (tx) => {
      const champion = await tx.champion.upsert({
        where: { name },
        update: championData,
        create: championData,
      });
      logger.info(`Upserted champion ${champion.name} with id ${champion.id}`);

      const tagConnections = [];
      for (const category in tags) {
        if (category === "All") continue;
        for (const tagName of tags[category]) {
          const tag = await tx.tag.upsert({
            where: { name_category: { name: tagName, category } },
            update: {},
            create: { name: tagName, category },
          });
          tagConnections.push({ id: tag.id });
        }
      }
      logger.info(`Upserted ${tagConnections.length} tags`);

      await tx.champion.update({
        where: { id: champion.id },
        data: {
          tags: {
            set: tagConnections,
          },
        },
      });
      logger.info(`Connected tags to champion ${champion.name}`);
    });
  }
  async syncSheet(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting sheet sync process for ${interaction.user.tag}`);

    try {
      await interaction.editReply("Starting sheet sync process...");

      logger.info("Fetching all champions from database...");
      const champions = await prisma.champion.findMany({
        include: {
          tags: true,
        },
      });
      logger.info(`Found ${champions.length} champions.`);

      champions.sort((a, b) => a.name.localeCompare(b.name));

      await interaction.editReply("Formatting data for Google Sheet...");
      logger.info("Formatting data for Google Sheet...");

      const headerRow = [
        "Champion Name",
        "Short Name",
        "Class",
        "All Tags",
        "AW Tags",
        "Release Date",
        "Obtainable",
        "Primary 32",
        "Primary 64",
        "Primary 128",
        "Primary 256",
        "Secondary 32",
        "Secondary 64",
        "Secondary 128",
        "Secondary 256",
        "Prestige 6*",
        "Prestige 7*",
        "Discord Emoji",
      ];

      const rows = champions.map((champion) => {
        const prestige = champion.prestige as { "6"?: number; "7"?: number };
        const capitalize = (s: string) =>
          s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        return [
          champion.name,
          champion.shortName,
          capitalize(champion.class),
          champion.tags.map((tag) => tag.name).join(", "),
          champion.tags
            .filter((tag) => tag.category === "Alliance Wars")
            .map((tag) => tag.name)
            .join(", "),
          champion.releaseDate.toISOString().split("T")[0],
          champion.obtainable.join(", "),
          getChampionImageUrl(champion.images, "32", "primary") || "",
          getChampionImageUrl(champion.images, "64", "primary") || "",
          getChampionImageUrl(champion.images, "128", "primary") || "",
          getChampionImageUrl(champion.images, "full", "primary") || "",
          getChampionImageUrl(champion.images, "32", "secondary") || "",
          getChampionImageUrl(champion.images, "64", "secondary") || "",
          getChampionImageUrl(champion.images, "128", "secondary") || "",
          getChampionImageUrl(champion.images, "full", "secondary") || "",
          prestige?.["6"] || "",
          prestige?.["7"] || "",
          champion.discordEmoji || "",
        ];
      });

      const values = [headerRow, ...rows];

      await interaction.editReply("Writing data to Google Sheet...");
      logger.info(
        `Writing ${values.length} rows to spreadsheet ${config.CHAMPION_SHEET_ID}`
      );

      await sheetsService.clearSheet(
        config.CHAMPION_SHEET_ID,
        config.championSheet.clearRange
      );
      await sheetsService.writeSheet(
        config.CHAMPION_SHEET_ID,
        config.championSheet.range,
        values
      );

      logger.info("Sheet sync process complete.");
      await interaction.editReply(
        `Sheet sync complete. ${champions.length} champions written to spreadsheet.`
      );
    } catch (error) {
      logger.error(error, "An error occurred during sheet sync");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async addChampionAbility(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability add process for ${interaction.user.tag}`
    );

    try {
      const championName = interaction.options.getString("champion", true);
      const type = interaction.options.getString(
        "type",
        true
      ) as AbilityLinkType;
      const abilityName = interaction.options.getString("ability", true);
      const source = interaction.options.getString("source") ?? null;

      await interaction.editReply(
        `Adding ${type.toLowerCase()} '${abilityName}' to **${championName}** from source '${
          source || "Unknown"
        }'...`
      );

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion) {
        await interaction.editReply(`Champion **${championName}** not found.`);
        return;
      }

      const ability = await prisma.ability.upsert({
        where: { name: abilityName },
        update: { name: abilityName },
        create: { name: abilityName, description: "" },
      });

      await prisma.championAbilityLink.create({
        data: {
          championId: champion.id,
          abilityId: ability.id,
          type,
          source,
        },
      });

      await interaction.editReply(
        `Successfully added ${type.toLowerCase()} '${abilityName}' to **${championName}**.`
      );
      logger.info(
        `Successfully added ability ${abilityName} to ${championName}`
      );
    } catch (error) {
      logger.error(error, "An error occurred during champion ability add");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async removeChampionAbility(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability remove process for ${interaction.user.tag}`
    );

    try {
      const championName = interaction.options.getString("champion", true);
      const type = interaction.options.getString(
        "type",
        true
      ) as AbilityLinkType;
      const abilityName = interaction.options.getString("ability", true);
      const source: string | null = interaction.options.getString("source");

      await interaction.editReply(
        `Removing ${type.toLowerCase()} '${abilityName}' from **${championName}** with source '${
          source || "Unknown"
        }'...`
      );

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion) {
        await interaction.editReply(`Champion **${championName}** not found.`);
        return;
      }

      const ability = await prisma.ability.findUnique({
        where: { name: abilityName },
      });
      if (!ability) {
        await interaction.editReply(`Ability '${abilityName}' not found.`);
        return;
      }

      const link = await prisma.championAbilityLink.findFirst({
        where: {
          championId: champion.id,
          abilityId: ability.id,
          type: type,
          source: source,
        },
      });

      if (!link) {
        await interaction.editReply(
          `Could not find ${type.toLowerCase()} '${abilityName}' with source '${
            source || "Unknown"
          }' for **${championName}**.`
        );
        return;
      }

      await prisma.championAbilityLink.delete({ where: { id: link.id } });

      await interaction.editReply(
        `Successfully removed ${type.toLowerCase()} '${abilityName}' from **${championName}**.`
      );
      logger.info(
        `Successfully removed ability ${abilityName} from ${championName}`
      );
    } catch (error) {
      logger.error(error, "An error occurred during champion ability remove");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async autocompleteAllAbilities(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const abilities = await prisma.ability.findMany({
      where: { name: { contains: focusedValue, mode: "insensitive" } },
      take: 25,
    });
    await interaction.respond(
      abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
  }

  async autocompleteChampionAbility(interaction: AutocompleteInteraction) {
    const championName = interaction.options.getString("champion");
    const type = interaction.options.getString("type") as AbilityLinkType;
    const focusedValue = interaction.options.getFocused();

    if (!championName || !type) {
      await interaction.respond([]);
      return;
    }

    const links = await prisma.championAbilityLink.findMany({
      where: {
        champion: { name: championName },
        type: type,
        ability: { name: { contains: focusedValue, mode: "insensitive" } },
      },
      include: {
        ability: true,
      },
      distinct: ["abilityId"],
      take: 25,
    });

    const abilities = links.map((link) => link.ability);
    await interaction.respond(
      abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
  }

  async autocompleteSource(interaction: AutocompleteInteraction) {
    const championName = interaction.options.getString("champion");
    const type = interaction.options.getString("type") as AbilityLinkType;
    const abilityName = interaction.options.getString("ability");
    const focusedValue = interaction.options.getFocused();

    if (!championName || !abilityName || !type) {
      await interaction.respond([]);
      return;
    }

    const links = await prisma.championAbilityLink.findMany({
      where: {
        champion: { name: championName },
        ability: { name: abilityName },
        type: type,
        source: { contains: focusedValue, mode: "insensitive" },
      },
      distinct: ["source"],
      take: 25,
    });

    const sources = links.map((link) => link.source);
    await interaction.respond(
      sources.map((source) => {
        const sourceValue = source === null ? "<None>" : source;
        return { name: sourceValue, value: sourceValue };
      })
    );
  }

  async draftChampionAbilities(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability draft process for ${interaction.user.tag}`
    );

    try {
      const championName = interaction.options.getString("champion", true);
      logger.info(`Drafting abilities for champion: ${championName}`);

      const initialContainer = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Drafting abilities for **${championName}**...`
        )
      );
      await interaction.editReply({
        components: [initialContainer],
        flags: [MessageFlags.IsComponentsV2],
      });

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion || !champion.fullAbilities) {
        await interaction.editReply(
          `Champion **${championName}** not found or has no fullAbilities.`
        );
        return;
      }

      logger.info("Reading ability draft prompt...");
      const systemPrompt = await fs.readFile(
        "src/prompts/champion-ability-draft.md",
        "utf-8"
      );
      const userPrompt = `Champion Name: ${championName}\n"full_abilities" JSON:\n\
        ${JSON.stringify(champion.fullAbilities, null, 2)}\n
        **Generate ONLY the JSON object for this new champion, strictly following all rules and examples provided.**`;

      logger.info("Sending ability draft request to LLM...");
      const response = await openRouterService.chat({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
      logger.info("Received ability draft response from LLM.");

      const draft = JSON.parse(response.choices[0].message.content);
      logger.info({ draft }, "Parsed ability draft from LLM response");
      pendingDrafts.set(champion.id.toString(), draft);

      const container = _buildDraftContainer(champion.name, champion.id, draft);

      logger.info("Sending confirmation message with drafted abilities.");
      await interaction.editReply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
    } catch (error) {
      logger.error(error, "An error occurred during champion ability draft");
      await interaction.editReply(
        `An error occurred: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

export const championAdminHelper = new ChampionAdminHelper();

registerModalHandler('addChampionModalPart1', championAdminHelper.handleChampionModalPart1);
registerModalHandler('addChampionModalPart2', championAdminHelper.handleChampionModalPart2);
registerButtonHandler('champion-add-part2', championAdminHelper.showChampionModalPart2);
