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
      const systemPrompt = `You are an MCOC Ability Extraction Expert. Your task is to analyze a champion\'s detailed "full_abilities" JSON and generate a new JSON object containing two lists: "abilities" and "immunities".

**Objective:**
Create a JSON object with two keys: "abilities" and "immunities". Each key will contain a list of objects, where each object has a "name" and a "source".

**Input for each champion will be:**

1. Champion Name: [Champion\'s Name]
2. "full_abilities" JSON:
   \`\`\`json
   ["full_abilities" JSON for the champion]
   \`\`\`

**Output required is ONLY the new JSON object for that champion.**

**Key Formatting Rules & Syntax to Strictly Follow:**

1.  **Output Structure:** The output must be a single JSON object with two keys: \`abilities\` and \`immunities\`.

    \`\`\`json
    {
      "abilities": [
        {
          "name": "Ability Name",
          "source": "Source of the ability"
        }
      ],
      "immunities": [
        {
          "name": "Immunity Name",
          "source": "Source of the immunity"
        }
      ]
    }
    \`\`\`

2.  **Ability/Immunity Name (\`name\`):**

    - Use the exact, standardized name of the effect (e.g., "Shock", "Fury", "Power Gain", "Unstoppable", "Stun Immune").
    - For immunities, use the name of the effect they are immune to (e.g., "Bleed", "Poison", "Stun").

3.  **Source (\`source\`):**
    - This should be a concise description of how the ability or immunity is triggered or applied.
    - Use common MCOC terms like "SP1", "SP2", "SP3", "Heavy Attack", "Light Attacks", "Medium Attacks", "Signature Ability", "Always Active".
    - If an ability is part of the signature ability, start the source with "Dupe".
    - if an immunity has no condition and is just always active leave the source blank.
    - Include conditions, durations, stack limits, and cooldowns if they are important.

**Here are some examples of input "full_abilities" and the desired JSON output:**

--- EXAMPLE 1 ---
Champion Name: Beta Ray Bill
"full_abilities" JSON:

\`\`\`json
{
  "signature": {
    "name": "CHAMPION OF KORBIN",
    "description": "The potency of personal bursts of damage is increased by 9.2 - 40%.\\nReduce Call of Thunder’s Unstoppable cooldown by 2.08 - 10 seconds.\\nWhile a personal Unstoppable Buff is active, damage taken is reduced by 20.81 - 100%. Does not reduce damage from Special Attack 3."
  },
  "abilities_breakdown": [
    {
      "type": "Always Active",
      "title": "General Passives & Immunities",
      "description": "Incoming Bleed and Poison effects suffer 50% reduced potency.\\nBeta Ray Bill is Immune to Shock and Power Drain. When the Power Drain Immunity triggers, he gains a Power Gain Passive, granting 1 Bar of Power over 0.5 seconds. Cooldown: 14 seconds.\\nWhen starting a fight against Tech Champions or when Immune to an effect, gain a Steady Buff for 20 seconds.\\nThe Thor Relic increases the potency of personal Buffs by 25%."
    },
    {
      "type": "Heavy Attacks",
      "title": "Call of Thunder - While Charging a Heavy Attack",
      "description": "Gain an Unstoppable Buff. If struck while this Buff is active this effect goes on cooldown for 24 seconds.\\nAll Buffs on Beta Ray Bill and all Shocks on the Opponent are paused.\\nEvery 0.4 seconds gain a 20% Intensify Buff for 4 seconds. Max stacks: 5. Beta Ray Bill’s Heavy Attack can be charged for an extended duration.\\nWhile above 2 Bars of Power: while Beta Ray Bill is below 2 Stacks of Intensify, the Opponent suffers a 1,007.1 Intimidate Passive. At max stacks, the Opponent suffers a 10% Infuriate Passive.\\nActivating a Special Attack 2 while charging a Heavy Attack pauses all personal Buffs until Beta Ray Bill has landed or been struck by 4 Basic Hits per Intensify gained, up to a max of 20. Heavy Hits count as 2 hits. This effect does not trigger if it is already active.\\nReleasing the Heavy Attack grants a Grit Buff for 15 seconds."
    },
    {
      "type": "Medium Attacks",
      "title": "Armor Pulverizer",
      "description": "Beta Ray Bill’s first Medium Attack Pulverizes one Armor Up effect, removing it and dealing a burst of 10,071 Direct Damage."
    },
    {
      "type": "General",
      "title": "Shocks",
      "description": "If the Buff pause is not active, Basic Attacks have a 10% chance to inflict a Shock Passive, dealing 2,014.2 Energy Damage over 25 seconds. Max stacks: 12.\\nDuring a combo started with a Medium Attack, or while striking the Opponent with a Special Attack 1, the expiration rate of personal Shocks increases by 285%.\\nThe final hit of Special Attacks refreshes all Shocks on the Opponent.\\nAll Shocks are paused during the Opponent’s Special Attacks and Beta Ray Bill’s Special Attack 2.\\nWhen any Shock on the Opponent ends, deal a burst of 6,042.6 Energy Damage."
    },
    {
      "type": "Special Attack 1",
      "title": "Special Attack 1",
      "description": "On activation, gain an Fury Buff, granting +6,042.6 Attack Rating for 15 seconds. Max stacks: 3.\\nDuring this attack, the potency of personal bursts of damage is increased by 200%\\nWhile the personal Buff pause is active, when any Shock ends on the Opponent during this attack, inflict a personal Shock Passive."
    },
    {
      "type": "Special Attack 2",
      "title": "Special Attack 2",
      "description": "The first hit grants a non-stacking 15% Energize Buff for 15 seconds.\\nAll lightning hits inflict a personal Shock Passive. Each Intensify Buff grants a 10%  chance to inflict these Shocks through Block."
    },
    {
      "type": "Special Attack 3",
      "title": "Special Attack 3",
      "description": "Gain a 100% Resonance Buff for 20 seconds, paused during Special Attack."
    }
  ]
}
\`\`\`

Desired JSON Output:

\`\`\`json
{
  "abilities": [
    {
      "name": "Ignore Damage",
      "source": "Dupe & Personal Unstoppable Active → 20-100% Reduction, except SP3"
    },
    { "name": "Shock", "source": "Passive, Basic Attacks → 10% Chance" },
    { "name": "Shock", "source": "Special Attacks → Refresh all Shocks" },
    { "name": "Shock", "source": "Passive, SP2 → Lightning Hits" },
    { "name": "Fury", "source": "SP1 → 15s, Max 3" },
    { "name": "Steady", "source": "Immunity triggers" },
    { "name": "Steady", "source": "Start Fight & Against Tech" },
    {
      "name": "Power Gain",
      "source": "Passive, Power Drain immunity triggers → 1 Bar of Power → 14s Cooldown"
    },
    { "name": "Pulverize", "source": "First Medium Attack" },
    { "name": "Grit", "source": "Heavy Attack" },
    { "name": "Unstoppable", "source": "Charging Heavy Attack" },
    {
      "name": "Intensify",
      "source": "Charging Heavy Attack → Every 0.4s up to 5 stacks"
    },
    {
      "name": "Intimidate",
      "source": "Passive, Charging Heavy & 2+ Bars of Power & Below 2 stacks of Intensify"
    },
    {
      "name": "Infuriate",
      "source": "Passive, Charging Heavy & 2+ Bars of Power & Max Intensify"
    },
    { "name": "Burst Damage", "source": "Direct, Pulverize" },
    { "name": "Burst Damage", "source": "Energy, Shock expires" },
    { "name": "Energize", "source": "SP2 → 15s" },
    { "name": "Resonance", "source": "SP3 → 20s" }
  ],
  "immunities": [
    { "name": "Shock", "source": "" },
    { "name": "Power Drain", "source": "" }
  ]
}
\`\`\`

--- END EXAMPLE 1 ---

--- EXAMPLE 2 ---
Champion Name: Galan
"full_abilities" JSON:

\`\`\`json
{
    "signature": {
        "name": "HUMBLE GOD OF THE BATTLEREALM",
        "description": "Always Active\\nWhenever Galan prevents a Power Drain, Burn, Lock or Special Lock effect from a non-Mystic Champion via immunity, he gains 1 - 3 indefinite Physical Resistance and Energy Resistance Buffs (Rounded Up). These Buffs are the same as those gained from striking the Opponent with the Staff of Taa.\\nWhile the Harvest is active: Galan becomes Stun Immune and deals a burst of 96.9 - 301.35 Direct Damage whenever Galan gains any amount of Planetary Mass, this Damage scales with Base Attack only."
    },
    "abilities_breakdown": [
        {
            "type": "Passive",
            "title": "Solar Intensity",
            "description": "Solar Intensity - Max 3\\nGalan starts each quest with 1 Persistent Solar Intensity. This becomes 2 when Defending, and 3 if Defending a final boss node.\\nWhen Galan defeats a non-#Dimensional being, he gains 1 additional Solar Intensity.\\nAt the start of the fight gain 1 indefinite Intensify Passive for each Solar Intensity, each increasing the potency of all future Buffs by 20%.\nAt 3 Solar Intensity, all of Galan’s Special Attacks gain a True Sense Buff, bypassing the effects of Miss and Auto-Block."
        },
        {
            "type": "Passive",
            "title": "Taa\'an Biology",
            "description": "Taa’an Biology - Always Active\\nGalan’s otherworldly nature provides immunity to Fate Seals and Nullify effects.\\nAdditionally, the Staff of Taa preserves Galan’s Power and grants immunity to Power Drain, Burn, Lock and Special Lock.\\nGalan’s first Light Attack and second Medium Attack strike with the Planetary side of the Staff of Taa, granting Galan 1 indefinite Resist Physical Buff, increasing Physical Resistance by 99.74. Max 20.\\nGalan’s first Medium Attack strikes with the Solar side of the Staff of Taa, granting Galan 2 indefinite Resist Energy Buffs, increasing Energy Resistance by 99.74. Max 20.\\nBuilding additional Resistance Buffs while at their maximum quantity will replace previous versions with an updated Potency."
        },
        {
            "type": "General",
            "title": "Planetary Mass and Harvest",
            "description": "Planetary Mass and Harvest\\nWhenever Galan gains a Buff, his Planetary Mass is increased by 10. Galan also gains 50 Planetary Mass whenever the Opponent gains an Armor Up effect. Max 999.\\nWhenever Galan is knocked down by a Special Attack, he loses 30 Planetary Mass per bar of Power spent.\\nLanding a Heavy Attack with 100 or more Planetary Mass will trigger the Harvest. Activating the Harvest on Attack prevents Galan from building Power if over 1 Bar of Power.\\nOn Defense, the Harvest activates when Galan reaches 100 or more Planetary Mass.\\nThe Harvest lasts for 14 seconds, when the Harvest ends, Galan consumes all Planetary Mass to deal a burst of 585.7 Direct Damage for each Planetary Mass consumed, this Damage scales with Base Attack only and is halved on Defense.\\nWhile the Harvest is active, Galan gains an Unstoppable Buff and a Regeneration Buff, healing 298.59 Health per second.\\nIf Galan performs a Special Attack while the Harvest is active, it becomes Unblockable and the Harvest ends. The burst of Damage triggers on the final hit of the Special Attack."
        },
        {
            "type": "Special Attack 1",
            "title": "Special Attack 1",
            "description": "On activation, Galan gains 4 Fury Buffs, these Furies last for 26 second(s) and increase Attack Rating by 813.44.\\nWhile the Harvest is active: Convert all of Galan’s Resistance Buffs into 5 Planetary Mass each."
        },
        {
            "type": "Special Attack 2",
            "title": "Special Attack 2",
            "description": "On activation, Galan gains 8 Intensify Buffs, each lasting 22 second(s) and increasing the potency of all new Buffs by 5%.\\nThe final 3 hits each inflict 1 Incinerate Debuff dealing 12,710 Energy Damage over 14 seconds.\\nWhile the Harvest is active: Instead inflict 3 Incinerates per hit with the same Potency and Duration."
        },
        {
            "type": "Special Attack 3",
            "title": "Special Attack 3",
            "description": "Galan immediately gains 200 Planetary Mass and begins a Planetary Harvest if it is not already active.\\nIf activated while the Harvest is already active, refresh the duration of the currently active Harvest and enable Galan to gain Power again."
        },
        {
            "type": "General",
            "title": "Cosmic Seed Heralds",
            "description": "Cosmic Seed Heralds\\nOnce per Quest, Galan can consume 2 Solar Intensity in the Pre-Fight Menu to place a Cross-Fight Cosmic Seed on the next fight. The next Cosmic Champion excluding Galan to enter this fight gains the Seed and becomes a Herald for the rest of the Quest. Whenever a Herald emerges victorious, the Seed will grow in power to grant abilities. Victories max out at 5.\\n0+ Victories - Heralds reduce the potency of all Power Burn effects by 100%.\n1+ Victories - Heralds gain a 7% Resistance to all Damaging Debuffs for each Victory.\n2+ Victories - Heralds become Unblockable when launching a Special Attack into an Opponent’s block, this Buff lasts for the duration of the Special Attack with an additional 1 second(s) added for each Victory. Once activated, this ability goes on cooldown for 24 seconds, and won\'t trigger while it\'s active."
        }
    ]
}
\`\`\`

Desired JSON Output:

\`\`\`json
{
  "abilities": [
    {
      "name": "True Sense",
      "source": "On Special Attacks & 3+ Solar Intensity"
    },
    { "name": "True Sense", "source": "On Special Attacks & Harvest" },
    { "name": "Physical Resist", "source": "First Light Attack" },
    { "name": "Physical Resist", "source": "Second Medium Attack" },
    {
      "name": "Physical Resist",
      "source": "Dupe & Power Control Immunity (Non-Mystic)"
    },
    { "name": "Energy Resist", "source": "First Medium Attack" },
    {
      "name": "Energy Resist",
      "source": "Dupe & Power Control Immunity (Non-Mystic)"
    },
    { "name": "Unstoppable", "source": "Harvest" },
    { "name": "Regeneration", "source": "Harvest" },
    { "name": "Fury", "source": "SP1 → 26s" },
    {
      "name": "Intensify",
      "source": "Passive, Start of Fight (Solar Intensity based)"
    },
    { "name": "Intensify", "source": "SP2 → 22s" },
    { "name": "Incinerate", "source": "SP2" },
    { "name": "Pre-Fight Ability", "source": "Cosmic Seed Heralds" },
    { "name": "Stun Immune", "source": "Dupe & Harvest Active" },
    {
      "name": "Burst Damage",
      "source": "Dupe & Gain Planetary Mass (Harvest Active)"
    },
    { "name": "Burst Damage", "source": "Harvest Ends (Planetary Mass based)" }
  ],
  "immunities": [
    { "name": "Fate Seal", "source": "" },
    { "name": "Nullify", "source": "" },
    { "name": "Power Drain", "source": "" },
    { "name": "Power Burn", "source": "" },
    { "name": "Power Lock", "source": "" },
    { "name": "Special Lock", "source": "" }
  ]
}
\`\`\`

--- END EXAMPLE 2 ---

--- EXAMPLE 3 ---
Champion Name: Gamora
"full_abilities" JSON:

\`\`\`json
{
    "signature": {
        "name": "DEADLIEST WOMAN IN THE GALAXY",
        "description": "Special Attacks - Godslayer Strike\\nGamora’s skill with the Godslayer Blade grows, increasing the chance to activate it during Special Attacks to 100%. Additionally, the cooldown is reduced to 50 - 20 seconds."
    },
    "abilities_breakdown": [
        {
            "type": "Light Attacks",
            "title": "Light Attacks",
            "description": "65% chance to gain a Fury Buff, granting +1,689.44 Attack Rating for 14 seconds. Max: 25."
        },
        {
            "type": "Medium Attacks",
            "title": "Medium Attacks",
            "description": "65% chance to gain a Cruelty Buff, increasing Critical Damage Rating by 85.05 for 14 seconds. Max: 25."
        },
        {
            "type": "Passive",
            "title": "Always Active",
            "description": "Gamora’s personal Buffs gain +1.5% duration for every 1 seconds that have passed during the fight. Max bonus: +60%.\nIf Gamora has 8 or more personal Buffs active, her attacks cannot Miss."
        },
        {
            "type": "Heavy Attacks",
            "title": "Heavy Attacks",
            "description": "Refreshes the duration of all personal Buffs."
        },
        {
            "type": "General",
            "title": "Special Attacks - Godslayer Strike",
            "description": "Gamora begins each fight with a Godslayer Strike ready, which has a 65% chance to activate during each Special Attack. Once Godslayer Strike is used, it goes on Cooldown for 100 seconds."
        },
        {
            "type": "Special Attack 1",
            "title": "Special Attack 1",
            "description": "This attack has 100% Critical Hit Chance.\n100% chance to inflict Bleed, dealing 10,559 Direct Damage over 5 seconds.\nGodslayer: Attack gains a flat +600% Critical Damage Multiplier."
        },
        {
            "type": "Special Attack 2",
            "title": "Special Attack 2",
            "description": "This attack has 100% Critical Hit Chance.\n80% chance to inflict an Armor Break Debuff, removing 1 Armor Up Buff and reducing Armor Rating by 523.81 for 18 seconds.\nGodslayer: Armor Break Debuffs during the attack gain +50% Potency, +60% Duration and +150% Ability Accuracy."
        },
        {
            "type": "Special Attack 3",
            "title": "Special Attack 3",
            "description": "100% Chance to gain a True Strike Buff for 14 seconds, allowing this Champion to ignore Armor, Resistances, Auto-Block and all Evade effects.\nGodslayer: 100% chance to inflict a Shock Debuff causing 21,118 Energy Damage over 10 seconds. If the opponent is a Robot, instead inflict a Degeneration Debuff that deals double damage."
        }
    ]
}
\`\`\`

Desired JSON Output:

\`\`\`json
{
  "abilities": [
    { "name": "True Strike", "source": "SP3 → 14s" },
    { "name": "Cannot Miss", "source": "Passive, 8+ Buffs" },
    { "name": "Fury", "source": "Light Attacks → 65% Chance, 14s" },
    { "name": "Cruelty", "source": "Medium Attacks → 65% Chance, 14s" },
    { "name": "Bleed", "source": "SP1" },
    { "name": "Armor Break", "source": "SP2 → 18s" },
    { "name": "Shock", "source": "SP3 & Godslayer Strike" },
    {
      "name": "Degeneration",
      "source": "SP3 & Godslayer Strike & Opponent Robot/Shock Immune"
    },
    {
      "name": "Godslayer Strike",
      "source": "Special Attacks → 65% Chance (100% Dupe)"
    }
  ],
  "immunities": []
}
\`\`\`

--- END EXAMPLE 3 ---

--- EXAMPLE 4 ---
Champion Name: Korg
"full_abilities" JSON:

\`\`\`json
{
    "signature": {
        "name": "ROCK HARD THORNS",
        "description": "When Attacked\\nWhile Rock Shield is active and Korg is struck by a Medium, Heavy or Special Attack that makes contact, 4,547.5 - 12,731.78 Physical Damage is inflicted to the opponent. Damage scales with Base Attack only. This ability does not activate if the opponent’s hit deals Energy Damage and Mutant Champions take 25% less damage.\\nWhile Rock Shield is active, Korg has a 30.58 - 69.99% chance to Purify Debuffs and gain one Rock Shield charge for each Debuff Purified this way."
    },
    "abilities_breakdown": [
        {
            "type": "Passive",
            "title": "Rock Anatomy",
            "description": "Rock anatomy provides Korg immunity to Bleed, Shock and additional Critical Resistance but decreases his Energy Resistance by 20%."
        },
        {
            "type": "Passive",
            "title": "Crowd Excitement - Miek Appearance",
            "description": "The crowd goes crazy when Miek makes an appearance while Korg is blocking an attack, increasing Crowd Excitement by 1 for 20 seconds. +2 on Well Timed Blocks. Only 6 Crowd Excitement charges can be gained through this ability."
        },
        {
            "type": "Passive",
            "title": "Crowd Excitement - Opponent Evade/Dexterity",
            "description": "The crowd dislikes cowards, cheering for Korg when opponents Evade or Dexterity his Basic Attacks, increasing Crowd Excitement by 3 for 20 seconds. Only 12 Crowd Excitement charges can be gained through this ability."
        },
        {
            "type": "Conditional",
            "title": "Crowd Excitement Threshold",
            "description": "When Crowd Excitement reaches 6 or more, Korg becomes Unstoppable and Unblockable for 2 seconds."
        },
        {
            "type": "Heavy Attacks",
            "title": "Miek Expels Fluids",
            "description": "Miek expels fluids on opponents when hitting with a Heavy Attack, creeping out the crowd and consuming all Crowd Excitement to inflict Armor Break, reducing their Armor Rating by 1,027.47 for each Crowd Excitement charge for 8 seconds."
        },
        {
            "type": "Passive",
            "title": "Rock Shield - Charges",
            "description": "Korg begins the fight with 9 Rock Shield charges which are removed each time he is struck. An additional charge is removed when Korg’s Dash Attack is interrupted by a Light Attack and if Struck by a Special Attack 3, all Rock Shield charges are removed instead."
        },
        {
            "type": "Passive",
            "title": "Rock Shield - Damage Cap",
            "description": "While Rock Shield is active, powerful enemy attacks cannot deal more than 40% of the opponent\'s Base Attack Rating in a single hit. Special 3 Attacks cannot deal more than 120% of the opponent\'s Attack instead."
        },
        {
            "type": "Passive",
            "title": "Rock Shield - Reformation",
            "description": "When all charges are consumed, Rock Shield is shattered and it takes between 11 and 15 seconds to reform. Each time Rock Shield reforms it starts with 1 less charge."
        },
        {
            "type": "Special Attack 1",
            "title": "Special Attack 1",
            "description": "Opponents cannot Evade this attack.\nThis attack is Unblockable if Crowd Excitement is greater than 1."
        },
        {
            "type": "Special Attack 2",
            "title": "Special Attack 2",
            "description": "+10,911.6 Attack Rating for 2.5 seconds if Korg is Unblockable.\nInflicts Bleed, dealing 10,002.3 Direct Damage over 8 seconds."
        },
        {
            "type": "Special Attack 3",
            "title": "Special Attack 3",
            "description": "Crowd Excitement goes up by 9 for 20 seconds."
        }
    ]
}
\`\`\`

Desired JSON Output:

\`\`\`json
{
  "abilities": [
    { "name": "Purify", "source": "Dupe & Rock Shield active → 30-70% Chance" },
    { "name": "Unstoppable", "source": "Passive, 6+ Crowd Excitement → 2s" },
    { "name": "Unblockable", "source": "Passive, 6+ Crowd Excitement → 2s" },
    { "name": "Unblockable", "source": "SP1 & 1+ Crowd Excitement" },
    {
      "name": "Armor Break",
      "source": "Heavy Attack (consumes Crowd Excitement) → 8s"
    },
    { "name": "Cannot be Evaded", "source": "SP1" },
    { "name": "Bleed", "source": "SP2 → 8s" },
    { "name": "Fury", "source": "Passive, SP2 While Unblockable → 2.5s" },
    {
      "name": "Reflect Damage",
      "source": "Physical, Dupe & Struck by Contact Medium/Heavy/Special (Rock Shield active, non-Energy hit)"
    }
  ],
  "immunities": [
    { "name": "Bleed", "source": "" },
    { "name": "Shock", "source": "" }
  ]
}
\`\`\`

--- END EXAMPLE 4 ---

**Now, for the new champion:**

Champion Name: [Champion Name]
"full_abilities" JSON:

\`\`\`json
[full_abilities JSON for the new champion]
\`\`\`

**Generate ONLY the JSON object for this new champion, strictly following all rules and examples provided.**

\`\`\`

\`\``;
      const userPrompt = `Champion Name: ${championName}\n"full_abilities" JSON:\n\
        ${JSON.stringify(champion.fullAbilities, null, 2)}\n
        **Generate ONLY the JSON object for this new champion, strictly following all rules and examples provided.**`;

      const model = interaction.options.getString('model') ?? 'google/gemini-2.5-flash';
      logger.info("Sending ability draft request to LLM...");
      const response = await openRouterService.chat({
        model: model,
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
