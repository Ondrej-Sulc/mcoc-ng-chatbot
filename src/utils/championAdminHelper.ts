import { CommandInteraction, GuildEmoji, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { gcpStorageService } from '../services/gcpStorageService';
import { openRouterService, OpenRouterMessage } from '../services/openRouterService';
import { PrismaClient, ChampionClass } from '@prisma/client';
import { config } from '../config';
import logger from '../services/loggerService';
import { sheetsService } from '../services/sheetsService';
import { getChampionImageUrl } from './championHelper';

const prisma = new PrismaClient();
const pendingChampions = new Map<string, any>();

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

class ChampionAdminHelper {
  async showChampionModalPart1(interaction: CommandInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('addChampionModalPart1')
      .setTitle('Add New Champion (Part 1/2)');

    const nameInput = new TextInputBuilder()
      .setCustomId('championName')
      .setLabel('Full Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const shortNameInput = new TextInputBuilder()
      .setCustomId('championShortName')
      .setLabel('Short Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const classInput = new TextInputBuilder()
      .setCustomId('championClass')
      .setLabel('Class (Science, Skill, etc.)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const primaryImageInput = new TextInputBuilder()
      .setCustomId('championPrimaryImage')
      .setLabel('Primary Image URL (Portrait)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const secondaryImageInput = new TextInputBuilder()
      .setCustomId('championSecondaryImage')
      .setLabel('Secondary Image URL (Featured)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(shortNameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(classInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(primaryImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(secondaryImageInput)
    );

    await interaction.showModal(modal);
  }

  async showChampionModalPart2(interaction: CommandInteraction | ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('addChampionModalPart2')
      .setTitle('Add New Champion (Part 2/2)');

    const tagsImageInput = new TextInputBuilder()
      .setCustomId('championTagsImage')
      .setLabel('Tags Image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const heroImageInput = new TextInputBuilder()
      .setCustomId('championHeroImage')
      .setLabel('Hero Image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const releaseDateInput = new TextInputBuilder()
      .setCustomId('championReleaseDate')
      .setLabel('Release Date (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const obtainableRangeInput = new TextInputBuilder()
      .setCustomId('championObtainableRange')
      .setLabel('Obtainable Range (e.g., "2-7")')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue('2-7');

    const prestigeInput = new TextInputBuilder()
      .setCustomId('championPrestige')
      .setLabel('6*,7* Prestige (e.g., 12345,13456)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue('0,0');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(tagsImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(heroImageInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(releaseDateInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(obtainableRangeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(prestigeInput)
    );

    await interaction.showModal(modal);
  }

  async handleChampionModalPart1(interaction: ModalSubmitInteraction) {
    if (!interaction.isModalSubmit()) return;

    try {
      await interaction.deferUpdate();

      const name = interaction.fields.getTextInputValue('championName');
      const shortName = interaction.fields.getTextInputValue('championShortName');
      const champClass = interaction.fields.getTextInputValue('championClass').toUpperCase() as ChampionClass;
      const primaryImageUrl = interaction.fields.getTextInputValue('championPrimaryImage');
      const secondaryImageUrl = interaction.fields.getTextInputValue('championSecondaryImage');

      const partialChampionData = {
        name,
        shortName,
        champClass,
        primaryImageUrl,
        secondaryImageUrl,
      };

      pendingChampions.set(interaction.user.id, partialChampionData);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('champion-add-part2')
            .setLabel('Continue')
            .setStyle(ButtonStyle.Primary),
        );

      await interaction.followUp({ 
        content: 'Part 1 of champion creation complete. Click continue to proceed to Part 2.', 
        components: [row], 
        ephemeral: true 
      });

    } catch (error) {
      logger.error(error, 'Error handling champion modal submission part 1');
      await interaction.followUp({ content: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, ephemeral: true });
    }
  }

  async handleChampionModalPart2(interaction: ModalSubmitInteraction) {
    if (!interaction.isModalSubmit()) return;

    try {
      await interaction.reply({ content: 'Processing part 2...', ephemeral: true });

      const partialChampionData = pendingChampions.get(interaction.user.id);
      if (!partialChampionData) {
        throw new Error('Could not find partial champion data. Please start over.');
      }

      const tagsImageUrl = interaction.fields.getTextInputValue('championTagsImage');
      const heroImageUrl = interaction.fields.getTextInputValue('championHeroImage');
      const releaseDate = interaction.fields.getTextInputValue('championReleaseDate');
      const obtainableRange = interaction.fields.getTextInputValue('championObtainableRange') || '2-7';
      
      const prestigeString = interaction.fields.getTextInputValue('championPrestige') || '0,0';
      const [prestige6String, prestige7String] = prestigeString.split(',').map(s => s.trim());

      const prestige6 = parseInt(prestige6String, 10);
      if (isNaN(prestige6)) {
        throw new Error(`Invalid number for 6-Star Prestige: ${prestige6String}`);
      }

      const prestige7 = parseInt(prestige7String || '0', 10);
      if (isNaN(prestige7)) {
        throw new Error(`Invalid number for 7-Star Prestige: ${prestige7String}`);
      }

      if (!Object.values(ChampionClass).includes(partialChampionData.champClass as ChampionClass)) {
        throw new Error(`Invalid champion class: ${partialChampionData.champClass}. Please use one of: ${Object.values(ChampionClass).join(', ')}`);
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
      logger.error(error, 'Error handling champion modal submission part 2');
      await interaction.followUp({ content: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`, ephemeral: true });
    }
  }

  async addChampion(interaction: CommandInteraction | ModalSubmitInteraction, championData: any) {
    logger.info(`Starting champion add process for ${interaction.user.tag}`);

    try {
      await interaction.editReply('Starting champion creation process...');

      const { name, shortName, champClass, tagsImageUrl, primaryImageUrl, secondaryImageUrl, heroImageUrl, releaseDate, obtainableRange, prestige6, prestige7 } = championData;

      logger.info(`Adding champion: ${name}`);

      // 1. Process and upload images
      await interaction.editReply('Processing and uploading images...');
      logger.info('Processing and uploading images...');
      const imageUrls = await this._processAndUploadImages(name, primaryImageUrl, secondaryImageUrl, heroImageUrl);
      logger.info('Image processing complete.');

      // 2. Process tags
      await interaction.editReply('Processing tags...');
      logger.info('Processing tags...');
      const tags = await this._processTags(tagsImageUrl);
      logger.info('Tag processing complete.');

      // 3. Create Discord Emoji
      await interaction.editReply('Creating Discord emoji...');
      logger.info('Creating Discord emoji...');
      const emoji = await this._createDiscordEmoji(interaction, shortName, imageUrls.p_128);
      logger.info(`Emoji created: ${emoji?.name}`);

      // 4. Save to Database
      await interaction.editReply('Saving champion to database...');
      logger.info('Saving champion to database...');
      await this._saveChampionToDb(name, shortName, champClass, releaseDate, obtainableRange, prestige6, prestige7, imageUrls, tags, emoji);
      logger.info('Champion saved to database.');

      await interaction.editReply(`Champion **${name}** created or updated successfully!`);
      logger.info(`Champion add process complete for ${name}`);
    } catch (error) {
      logger.error(error, 'An error occurred during champion creation');
      await interaction.editReply(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateChampionImages(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(`Starting champion image update process for ${interaction.user.tag}`);

    try {
      await interaction.editReply('Starting image update process...');

      const name = interaction.options.getString('name', true);
      const primaryImageUrl = interaction.options.getString('primary_image');
      const secondaryImageUrl = interaction.options.getString('secondary_image');
      const heroImageUrl = interaction.options.getString('hero_image');

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
      const existingPrimary = getChampionImageUrl(images, 'full', 'primary');
      const existingSecondary = getChampionImageUrl(images, 'full', 'secondary');

      await interaction.editReply('Processing and uploading new images...');
      logger.info('Processing and uploading new images...');
      const imageUrls = await this._processAndUploadImages(name, primaryImageUrl || existingPrimary, secondaryImageUrl || existingSecondary, heroImageUrl);
      logger.info('Image processing complete.');

      const newImages = { ...images, ...imageUrls };

      await prisma.champion.update({
        where: { id: champion.id },
        data: { images: newImages },
      });
      logger.info('Champion images updated in database.');

      await interaction.editReply(`Images for **${name}** updated successfully!`);
      logger.info(`Champion image update process complete for ${name}`);
    } catch (error) {
      logger.error(error, 'An error occurred during champion image update');
      await interaction.editReply(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async _processAndUploadImages(championName: string, primaryUrl: string | null, secondaryUrl: string | null, heroUrl: string | null) {
    logger.info(`_processAndUploadImages for ${championName}`);
    const formattedName = championName.replace(/ /g, '_').replace(/\(|\)|\'|\./g, '').toLowerCase();
    const tempDir = path.join(__dirname, '../../temp');
    await fs.mkdir(tempDir, { recursive: true });

    const imageUrls: any = {};

    // Process hero image
    if (heroUrl) {
      const heroImgBuffer = await downloadImage(heroUrl);
      const heroPath = path.join(tempDir, `${formattedName}_hero.png`);
      await fs.writeFile(heroPath, heroImgBuffer);
      const gcsHeroPath = `hero/${formattedName}.png`;
      imageUrls.hero = await gcpStorageService.uploadFile(heroPath, gcsHeroPath);
      logger.info(`Uploaded ${gcsHeroPath}`);
    }

    for (const type of ['primary', 'secondary']) {
      const url = type === 'primary' ? primaryUrl : secondaryUrl;
      if (url) {
        const imgBuffer = await downloadImage(url);
        const typePrefix = type.charAt(0);

        const originalSize = 256;
        const originalPath = path.join(tempDir, `${formattedName}_${type}_${originalSize}.png`);
        await sharp(imgBuffer).resize(originalSize, originalSize).toFile(originalPath);
        const gcsOriginalPath = `${originalSize}/${formattedName}_${type}.png`;
        const key = `full_${type}`;
        imageUrls[key] = await gcpStorageService.uploadFile(originalPath, gcsOriginalPath);
        logger.info(`Uploaded ${gcsOriginalPath}`);

        const blurredImg = sharp(imgBuffer).blur(0.5);

        for (const size of [128, 64, 32]) {
          const resizedPath = path.join(tempDir, `${formattedName}_${type}_${size}.png`);
          await blurredImg.clone().resize(size, size).toFile(resizedPath);
          const gcsResizedPath = `${size}/${formattedName}_${type}.png`;
          const key = `${typePrefix}_${size}`;
          imageUrls[key] = await gcpStorageService.uploadFile(resizedPath, gcsResizedPath);
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

    const base64Image = croppedImageBuffer.toString('base64');

    const system_message: OpenRouterMessage = {
        role: "system",
        content: [
            {
                type: "text",
                text: "Extract information from the image and fill in the following JSON structure, keep all the tag groups even if empty, include # with the tag values, omit 'No Tags' and leave an empty list value instead:\n          \"Combat Style\": [\"string\"],\n          \"Attributes\": [\"string\"],\n          \"Organization\": [\"string\"],\n          \"Alliance Wars\": [\"string\"],\n          \"Carina's Challenges\": [\"string\"],\n          \"Alliance Quest\": [\"string\"],\n          \"Release Date\": [\"string\"],\n          \"Saga\": [\"string\"]\n"
            }
        ]
    };

    const user_message: OpenRouterMessage = {
        role: "user",
        content: [
            {
                type: "image_url",
                image_url: {
                    url: `data:image/png;base64,${base64Image}`
                }
            }
        ]
    };

    logger.info('Sending image to OpenRouter for tag extraction...');
    const response = await openRouterService.chat({
      model: 'openai/gpt-4o',
      messages: [system_message, user_message],
      response_format: { type: 'json_object' },
    });

    const tags = JSON.parse(response.choices[0].message.content);
    logger.info({ tags }, 'Received tags from OpenRouter');
    const allTags = Object.values(tags).flat();
    tags['All'] = [...new Set(allTags)].sort();

    return tags;
  }

  private async _createDiscordEmoji(interaction: CommandInteraction | ModalSubmitInteraction, championShortName: string, imageUrl: string): Promise<any | undefined> {
    logger.info(`_createDiscordEmoji for ${championShortName}`);
    const { client } = interaction;
    const app = await client.application?.fetch();
    if (!app?.id) {
      logger.warn('Could not fetch application id for emoji creation');
      return;
    }

    const cleanName = championShortName.replace(/[^a-zA-Z0-9]/g, '');
    let emojiName = cleanName.substring(0, 3).toLowerCase();

    const emojisResponse = (await client.rest.get(Routes.applicationEmojis(app.id))) as any;

    const existingEmojis: any[] = Array.isArray(emojisResponse)
        ? emojisResponse
        : Array.isArray(emojisResponse?.items)
        ? emojisResponse.items
        : Array.isArray(emojisResponse?.emojis)
        ? emojisResponse.emojis
        : [];

    const existingEmojiNames = new Set(existingEmojis.map(e => e.name));

    let i = 1;
    while (existingEmojiNames.has(emojiName)) {
      if (cleanName.length >= 3) {
        emojiName = `${cleanName.substring(0, 2)}${cleanName.charAt(i % cleanName.length)}`.toLowerCase();
      } else {
        emojiName = `${cleanName}${i}`.toLowerCase();
      }
      i++;
      if (i > 100) { // safety break
        logger.error('Could not generate a unique emoji name after 100 attempts');
        throw new Error('Could not generate a unique emoji name.');
      }
    }
    logger.info(`Generated unique emoji name: ${emojiName}`);

    const imageBuffer = await downloadImage(imageUrl);
    const base64Image = imageBuffer.toString('base64');

    const emoji = await client.rest.post(Routes.applicationEmojis(app.id), {
      body: {
        name: emojiName,
        image: `data:image/png;base64,${base64Image}`,
      },
    });
    logger.info({ emoji }, 'Created new application emoji');

    return emoji;
  }

  private async _saveChampionToDb(name: string, shortName: string, champClass: ChampionClass, releaseDate: string, obtainableRange: string, prestige6: number, prestige7: number, imageUrls: any, tags: any, emoji: any | undefined) {
    logger.info(`_saveChampionToDb for ${name}`);
    const [start, end] = obtainableRange.split('-').map(Number);
    const obtainable = Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString());

    const prestige = {
      '6': prestige6,
      '7': prestige7,
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
        if (category === 'All') continue;
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
      await interaction.editReply('Starting sheet sync process...');

      logger.info('Fetching all champions from database...');
      const champions = await prisma.champion.findMany({
        include: {
          tags: true,
        },
      });
      logger.info(`Found ${champions.length} champions.`);

      champions.sort((a, b) => a.name.localeCompare(b.name));

      await interaction.editReply('Formatting data for Google Sheet...');
      logger.info('Formatting data for Google Sheet...');

      const headerRow = [
        'Champion Name', 'Short Name', 'Class', 'All Tags', 'AW Tags', 'Release Date', 'Obtainable',
        'Primary 32', 'Primary 64', 'Primary 128', 'Primary 256',
        'Secondary 32', 'Secondary 64', 'Secondary 128', 'Secondary 256',
        'Prestige 6*', 'Prestige 7*', 'Discord Emoji'
      ];

      const rows = champions.map(champion => {
        const prestige = champion.prestige as { '6'?: number; '7'?: number; };
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        return [
          champion.name,
          champion.shortName,
          capitalize(champion.class),
          champion.tags.map(tag => tag.name).join(', '),
          champion.tags.filter(tag => tag.category === 'Alliance Wars').map(tag => tag.name).join(', '),
          champion.releaseDate.toISOString().split('T')[0],
          champion.obtainable.join(', '),
          getChampionImageUrl(champion.images, '32', 'primary') || '',
          getChampionImageUrl(champion.images, '64', 'primary') || '',
          getChampionImageUrl(champion.images, '128', 'primary') || '',
          getChampionImageUrl(champion.images, 'full', 'primary') || '',
          getChampionImageUrl(champion.images, '32', 'secondary') || '',
          getChampionImageUrl(champion.images, '64', 'secondary') || '',
          getChampionImageUrl(champion.images, '128', 'secondary') || '',
          getChampionImageUrl(champion.images, 'full', 'secondary') || '',
          prestige?.['6'] || '',
          prestige?.['7'] || '',
          champion.discordEmoji || ''
        ];
      });

      const values = [headerRow, ...rows];

      await interaction.editReply('Writing data to Google Sheet...');
      logger.info(`Writing ${values.length} rows to spreadsheet ${config.CHAMPION_SHEET_ID}`);
      
      await sheetsService.clearSheet(config.CHAMPION_SHEET_ID, config.championSheet.clearRange);
      await sheetsService.writeSheet(config.CHAMPION_SHEET_ID, config.championSheet.range, values);

      logger.info('Sheet sync process complete.');
      await interaction.editReply(`Sheet sync complete. ${champions.length} champions written to spreadsheet.`);

    } catch (error) {
      logger.error(error, 'An error occurred during sheet sync');
      await interaction.editReply(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const championAdminHelper = new ChampionAdminHelper();
