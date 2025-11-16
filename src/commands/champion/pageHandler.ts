import {
  ButtonInteraction,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
  MessageFlags,
  SeparatorBuilder,
  AttachmentBuilder,
} from "discord.js";
import { getChampionDataById } from "../../services/championService";
import { createChampionActionRow, createPaginationActionRow } from "./actionRow";
import { getInfoContent } from "./info";
import { CLASS_COLOR } from "./view";
import { generateChampionThumbnail } from "./thumbnail";
import { getChampionImageUrl } from "../../utils/championHelper";

export async function handleChampionPageSwitch(interaction: ButtonInteraction) {
  await interaction.deferUpdate();

  const [_, championId, view, pageStr] =
    interaction.customId.split(":");
  const page = parseInt(pageStr, 10);

  const champion = await getChampionDataById(parseInt(championId, 10));
  if (!champion) {
    return;
  }

  if (view !== "info") return;

  // Regenerate thumbnail for the new page
  const newThumbnail = await generateChampionThumbnail({
    championName: champion.name.toUpperCase(),
    championClass: champion.class,
    secondaryImageUrl: getChampionImageUrl(champion.images, "full", "secondary"),
    primaryImageUrl: getChampionImageUrl(champion.images, "full", "primary"),
    subcommand: view,
    width: 800,
    height: 300,
  });

  const newThumbnailFileName = `${champion.name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase()}_${view}_${Date.now()}.png`;
  const newAttachment = new AttachmentBuilder(newThumbnail, {
    name: newThumbnailFileName,
  });

  const {
    content,
    currentPage,
    totalPages,
  } = getInfoContent(champion, page);

  const container = new ContainerBuilder();
  container.setAccentColor(CLASS_COLOR[champion.class]);

  const thumbnailGallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder()
      .setDescription(`**${champion.name}**`)
      .setURL(`attachment://${newThumbnailFileName}`)
  );
  container.addMediaGalleryComponents(thumbnailGallery);

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

  const paginationRow = createPaginationActionRow(
    champion.id.toString(),
    view,
    currentPage,
    totalPages
  );
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(paginationRow);

  container.addSeparatorComponents(new SeparatorBuilder());
  const viewActionRows = createChampionActionRow(
    champion.id.toString(),
    view
  );
  container.addActionRowComponents(...viewActionRows);

  await interaction.editReply({
    components: [container],
    files: [newAttachment],
    flags: [MessageFlags.IsComponentsV2],
  });
}
