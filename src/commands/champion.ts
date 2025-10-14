import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from "discord.js";
import { ChampionClass, Champion } from "@prisma/client";
import {
  getChampionData,
  ChampionWithAllRelations,
  AttackWithHits,
  ChampionAbilityLinkWithAbility,
  championList,
} from "../services/championService";
import { Command, CommandResult } from "../types/command";
import { createEmojiResolver } from "../utils/emojiResolver";
import { generateChampionThumbnail } from "../utils/thumbnailGenerator";
import {
  handleInfo,
  handleAttacks,
  handleAbilities,
} from "../utils/championView";

interface ChampionCoreParams {
  subcommand: string;
  championName: string;
  userId: string;
}

import { getChampionImageUrl } from "../utils/championHelper";

export async function core(
  params: ChampionCoreParams,
  resolveEmoji: (text: string) => string
): Promise<CommandResult> {
  const { subcommand, championName, userId } = params;

  const champion = await getChampionData(championName);

  if (!champion) {
    return {
      content: `Champion "${championName}" not found.`,
      flags: MessageFlags.Ephemeral,
    };
  }

  const thumbnail = await generateChampionThumbnail({
    championName: champion.name.toUpperCase(),
    championClass: champion.class,
    secondaryImageUrl: getChampionImageUrl(
      champion.images,
      "full",
      "secondary"
    ),
    primaryImageUrl: getChampionImageUrl(champion.images, "full", "primary"),
    subcommand: subcommand,
    width: 800,
    height: 300,
  });

  // Bust any client-side caching by appending a timestamp to the filename
  const cacheBust = Date.now();
  const thumbnailFileName = `${champion.name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase()}_thumbnail_${cacheBust}.png`;
  const attachment = new AttachmentBuilder(thumbnail, {
    name: thumbnailFileName,
    description: `Thumbnail for ${champion.name}`,
  });

  const thumbnailmediaGallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder()
      .setDescription(`**${champion.name}**`)
      .setURL(`attachment://${thumbnailFileName}`)
  );

  let result: CommandResult;

  switch (subcommand) {
    case "info":
      result = handleInfo(champion);
      break;
    case "attacks":
      result = handleAttacks(champion);
      break;
    case "abilities":
    case "immunities":
      result = handleAbilities(
        champion,
        subcommand as "abilities" | "immunities",
        resolveEmoji
      );
      break;
    default:
      return { content: "Invalid subcommand.", flags: MessageFlags.Ephemeral };
  }

  if (result.components && result.components.length > 0) {
    result.components[0].components.unshift(thumbnailmediaGallery);
  }

  result.files = [attachment];
  return result;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("champion")
    .setDescription("Get information about a specific champion.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Display a champion's core details and full abilities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("attacks")
        .setDescription("Display a champion's attack types and properties.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("abilities")
        .setDescription("List all of a champion's abilities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("immunities")
        .setDescription("List all of a champion's immunities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = championList.filter(champion =>
        champion.name.toLowerCase().includes(focusedValue)
    );

    // Slice to get the top 25 results
    const results = filtered.slice(0, 25);

    await interaction.respond(
      results.map(champion => ({
        name: champion.name,
        value: champion.name,
      }))
    );
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [] });

    const subcommand = interaction.options.getSubcommand();
    const championName = interaction.options.getString("champion");

    if (!championName) {
      await interaction.editReply({
        content: "You must provide a champion name.",
      });
      return;
    }

    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await core(
      {
        subcommand,
        championName,
        userId: interaction.user.id,
      },
      resolveEmoji
    );

    if (result.components && Array.isArray(result.components)) {
      const firstContainer = result.components.shift();
      if (firstContainer) {
        await interaction.editReply({
          content: result.content || "",
          components: [firstContainer],
          flags: [MessageFlags.IsComponentsV2],
          files: result.files || [],
        });
      }

      for (const container of result.components) {
        await interaction.followUp({
          components: [container],
          ephemeral: false,
          flags: [MessageFlags.IsComponentsV2],
          files: result.files || [],
        });
      }
    } else if (result.embeds) {
      await interaction.editReply({
        content: result.content || "",
        embeds: result.embeds,
      });
    } else if (result.content) {
      await interaction.editReply({ content: result.content });
    }
  },
};

export default command;
