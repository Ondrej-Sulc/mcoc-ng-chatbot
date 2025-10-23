import {
  CommandInteraction,
  GuildEmoji,
  Routes,
  ModalSubmitInteraction,
} from "discord.js";
import sharp from "sharp";
import { gcpStorageService } from "../../../services/gcpStorageService";
import {
  openRouterService,
  OpenRouterMessage,
} from "../../../services/openRouterService";
import { prisma } from "../../../services/prismaService";
import { ChampionClass } from "@prisma/client";
import logger from "../../../services/loggerService";

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

export async function processAndUploadImages(
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
    const imageUrls: any = {};

    // Process hero image
    if (heroUrl) {
      const heroImgBuffer = await downloadImage(heroUrl);
      const gcsHeroPath = `hero/${formattedName}.png`;
      imageUrls.hero = await gcpStorageService.uploadBuffer(
        heroImgBuffer,
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
        const gcsOriginalPath = `${originalSize}/${formattedName}_${type}.png`;
        const key = `full_${type}`;
        imageUrls[key] = await gcpStorageService.uploadBuffer(
          await sharp(imgBuffer).resize(originalSize, originalSize).toBuffer(),
          gcsOriginalPath
        );
        logger.info(`Uploaded ${gcsOriginalPath}`);

        const blurredImg = sharp(imgBuffer).blur(0.5);

        for (const size of [128, 64, 32]) {
          const gcsResizedPath = `${size}/${formattedName}_${type}.png`;
          const key = `${typePrefix}_${size}`;
          imageUrls[key] = await gcpStorageService.uploadBuffer(
            await blurredImg.clone().resize(size, size).toBuffer(),
            gcsResizedPath
          );
          logger.info(`Uploaded ${gcsResizedPath}`);
        }
      }
    }

    return imageUrls;
  }

export async function processTags(imageUrl: string): Promise<any> {
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
text: "Extract information from the image and fill in the following JSON structure, keep all the tag groups even if empty, include # with the tag values, omit 'No Tags' and leave an empty list value instead:\n          \"Combat Style\": [\"string\"],\n          \"Attributes\": [\"string\"],\n          \"Organization\": [\"string\"],\n          \"Alliance Wars\": [\"string\"],\n          \"Carina's Challenges\": [\"string\"],\n          \"Alliance Quest\": [\"string\"],\n          \"Release Date\": [\"string\"],\n          \"Saga\": [\"string\"]\n"        },
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
      model: "google/gemini-2.5-flash",
      messages: [system_message, user_message],
      response_format: { type: "json_object" },
    });

    const tags = JSON.parse(response.choices[0].message.content);
    logger.info({ tags }, "Received tags from OpenRouter");
    const allTags = Object.values(tags).flat();
    tags["All"] = [...new Set(allTags)].sort();

    return tags;
}

export async function createDiscordEmoji(
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

export async function saveChampionToDb(
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

export async function addChampion(
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
      const imageUrls = await processAndUploadImages(
        name,
        primaryImageUrl,
        secondaryImageUrl,
        heroImageUrl
      );
      logger.info("Image processing complete.");

      // 2. Process tags
      await interaction.editReply("Processing tags...");
      logger.info("Processing tags...");
      const tags = await processTags(tagsImageUrl);
      logger.info("Tag processing complete.");

      // 3. Create Discord Emoji
      await interaction.editReply("Creating Discord emoji...");
      logger.info("Creating Discord emoji...");
      const emoji = await createDiscordEmoji(
        interaction,
        shortName,
        imageUrls.p_128
      );
      logger.info(`Emoji created: ${emoji?.name}`);

      // 4. Save to Database
      await interaction.editReply("Saving champion to database...");
      logger.info("Saving champion to database...");
      await saveChampionToDb(
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
