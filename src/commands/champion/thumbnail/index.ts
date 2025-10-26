import sharp from "sharp";
import { ChampionThumbnailOptions } from "./types";
import {
  CLASS_COLORS,
  CLASS_PATTERN_CONFIG,
  DEFAULTS,
} from "./constants";
import {
  fetchArrayBufferWithTimeout,
  loadTitleFont,
  computeTitleLayout,
  buildTitlePathsMarkup,
  adjustColorBrightness,
} from "./utils";
import {
  createBackgroundSvg,
  createGlassPanelSvg,
  createChampionImageFrameSvg,
  createInnerFrameDarkeningSvg,
  createTextAndPillsSvg,
  getFramePath,
} from "./svg";
import { createCircularAvatar } from "./avatar";

// ---- main ----

export async function generateChampionThumbnail(
  options: ChampionThumbnailOptions
): Promise<Buffer> {
  const {
    championName,
    championClass,
    secondaryImageUrl,
    primaryImageUrl,
    subcommand,
    width = DEFAULTS.width,
    height = DEFAULTS.height,
    fetchTimeoutMs = DEFAULTS.fetchTimeoutMs,
    patternScale,
    patternOpacityMultiplier,
  } = options;

  const colors =
    CLASS_COLORS[championClass as keyof typeof CLASS_COLORS] ??
    CLASS_COLORS.SKILL;

  const classPatternConfig =
    CLASS_PATTERN_CONFIG[championClass] ?? CLASS_PATTERN_CONFIG.SKILL; // Default for safety

  const finalPatternScale = patternScale ?? classPatternConfig.scale;
  const finalPatternOpacity =
    patternOpacityMultiplier ?? classPatternConfig.opacity;

  // Fetch images
  const [secondaryAB, primaryAB] = await Promise.all([
    fetchArrayBufferWithTimeout(secondaryImageUrl, fetchTimeoutMs),
    primaryImageUrl
      ? fetchArrayBufferWithTimeout(primaryImageUrl, fetchTimeoutMs)
      : Promise.resolve(undefined),
  ]);

  // Layout: reserve a square on the right sized by the canvas height.
  const rightSquareWidth = Math.min(height, width); // safety if width < height
  const leftPanelWidth = Math.max(0, width - rightSquareWidth);

  // Create the unified, full-width background
  const bg = createBackgroundSvg(
    width,
    height,
    leftPanelWidth,
    colors.primary,
    colors.secondary,
    championClass,
    finalPatternScale,
    finalPatternOpacity
  );

  // Layout metrics
  const avatarDiameter = primaryAB
    ? Math.min(Math.floor(height * 0.44), Math.floor(leftPanelWidth * 0.34))
    : 0;
  const avatarLeft = DEFAULTS.padding - 15;
  const avatarTop =
    Math.floor(height) - Math.floor(avatarDiameter) - DEFAULTS.padding;
  const pillsLeft =
    DEFAULTS.padding + (avatarDiameter ? avatarDiameter + 15 : 0);
  const pillsBottom = DEFAULTS.padding;
  const titleRightLimit = Math.max(0, leftPanelWidth - DEFAULTS.padding * 2);

  // ---- Pre-compose the right panel ----
  let rightPanelContent: Buffer | undefined;
  if (rightSquareWidth > 0) {
    const darkeningSvg = createInnerFrameDarkeningSvg(
      rightSquareWidth,
      colors.primary,
      colors.secondary
    );
    const characterPng = await sharp(Buffer.from(secondaryAB))
      .resize({
        width: rightSquareWidth,
        height: rightSquareWidth,
        fit: "cover",
        position: "center",
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    const frameClipPath = getFramePath(rightSquareWidth);
    const clipMask = Buffer.from(`
      <svg width="${rightSquareWidth}" height="${rightSquareWidth}" xmlns="http://www.w3.org/2000/svg">
        <path d="${frameClipPath}" fill="#fff"/>
      </svg>
    `);

    const clippedCharacter = await sharp(characterPng)
      .composite([
        {
          input: clipMask,
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    // Base is the darkening layer, then composite the clipped character on top.
    rightPanelContent = await sharp(darkeningSvg)
      .composite([
        {
          input: clippedCharacter,
          blend: "over",
        },
      ])
      .png()
      .toBuffer();
  }

  // ---- Build final overlays ----
  const overlays: sharp.OverlayOptions[] = [];

  // Left glass panel for readability
  if (leftPanelWidth > 0) {
    overlays.push({
      input: createGlassPanelSvg(width, height, DEFAULTS.panelRadius),
      left: 0,
      top: 0,
    });
  }

  // Add the pre-composited right panel
  if (rightPanelContent) {
    overlays.push({
      input: rightPanelContent,
      left: width - rightSquareWidth,
      top: 0,
    });
  }

  // Add the geometric frame over the champion art
  if (rightSquareWidth > 0) {
    const frameSvg = createChampionImageFrameSvg(
      rightSquareWidth,
      colors.primary,
      colors.secondary
    );
    overlays.push({
      input: frameSvg,
      left: width - rightSquareWidth,
      top: 0,
    });
  }

  // Title and pills
  if (leftPanelWidth > 0) {
    const loadedFont = await loadTitleFont();
    let titlePathsMarkup: string | undefined;
    let titleLayout = computeTitleLayout(
      championName,
      DEFAULTS.padding,
      titleRightLimit,
      loadedFont
    );
    if (loadedFont) {
      titlePathsMarkup = buildTitlePathsMarkup(
        loadedFont,
        titleLayout.lines,
        titleLayout.fontSize,
        DEFAULTS.padding,
        titleLayout.yTitle,
        titleLayout.maxTitleWidth
      );
    }

    overlays.push({
      input: createTextAndPillsSvg({
        title: championName,
        subcommand,
        width: leftPanelWidth,
        height,
        padding: DEFAULTS.padding,
        titleRightLimit,
        pillsLeft,
        pillsBottom,
        chipStart: colors.primary,
        chipEnd: colors.secondary,
        titleAsPaths: titlePathsMarkup,
        font: loadedFont,
      }),
      left: 0,
      top: 0,
    });
  }

  // Avatar
  if (primaryAB) {
    const avatar = await createCircularAvatar({
      image: Buffer.from(primaryAB),
      diameter: avatarDiameter,
      ringWidth: DEFAULTS.avatarRing,
      ringStart: colors.primary,
      ringEnd: colors.secondary,
    });
    overlays.push({
      input: avatar,
      left: avatarLeft,
      top: avatarTop,
    });
  }

  // Final compose
  const finalImage = await sharp(bg).composite(overlays).png().toBuffer();
  return finalImage;
}
