import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from "discord.js";
import { getChampionData, championList } from "../../services/championService";
import { Command, CommandResult } from "../../types/command";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { generateChampionThumbnail } from "../../utils/thumbnailGenerator";
import { getChampionImageUrl } from "../../utils/championHelper";
import { handleInfo } from "./info";
import { handleAttacks } from "./attacks";
import { handleAbilities } from "./abilities";
import { handleImmunities } from "./immunities";
import { handleTags } from "./tags";
import { handleOverview } from "./overview";
import { handleDuel } from "./duel";

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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("tags")
        .setDescription("List all of a champion's tags.")
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
        .setName("overview")
        .setDescription("Display a champion's abilities, immunities, and tags.")
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
        .setName("duel")
        .setDescription("Get duel targets for a champion.")
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
    const filtered = championList.filter((champion) =>
      champion.name.toLowerCase().includes(focusedValue)
    );

    // Slice to get the top 25 results
    const results = filtered.slice(0, 25);

    await interaction.respond(
      results.map((champion) => ({
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

    const champion = await getChampionData(championName);

    if (!champion) {
      await interaction.editReply({
        content: `Champion "${championName}" not found.`,
      });
      return;
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

    const resolveEmoji = createEmojiResolver(interaction.client);
    let result: CommandResult;

    switch (subcommand) {
      case "info":
        result = handleInfo(champion);
        break;
      case "attacks":
        result = handleAttacks(champion);
        break;
      case "abilities":
        result = handleAbilities(champion, resolveEmoji);
        break;
      case "immunities":
        result = handleImmunities(champion, resolveEmoji);
        break;
      case "tags":
        result = handleTags(champion);
        break;
      case "overview":
        result = handleOverview(champion, resolveEmoji);
        break;
      case "duel":
        result = handleDuel(champion);
        break;
      default:
        await interaction.editReply({ content: "Invalid subcommand." });
        return;
    }

    if (result.components && result.components.length > 0) {
      result.components[0].components.unshift(thumbnailmediaGallery);
    }

    result.files = [attachment];

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
