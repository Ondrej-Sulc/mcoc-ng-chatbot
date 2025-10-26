import { ChampionClass } from "@prisma/client";
import * as opentype from "opentype.js";
import { CLASS_PATTERNS } from "./constants";
import { clamp, escapeXml, computeTitleLayout, adjustColorBrightness } from "./utils";

// ---- background (consistent, full-canvas) ----

export function createBackgroundSvg(
  width: number,
  height: number,
  leftPanelWidth: number,
  primary: string,
  secondary: string,
  championClass: ChampionClass,
  patternScale: number,
  patternOpacityMultiplier: number
): Buffer {
  const seamX = clamp(leftPanelWidth, 0, width);
  let pattern = CLASS_PATTERNS[championClass] ?? CLASS_PATTERNS.SKILL; // Default for safety

  // Inject scale
  const scaleTransform = `scale(${patternScale})`;
  const transformRegex = /patternTransform="([^"]*)"/;
  const match = pattern.match(transformRegex);

  if (match) {
    const existingTransforms = match[1];
    pattern = pattern.replace(
      existingTransforms,
      `${scaleTransform} ${existingTransforms}`
    );
  } else {
    pattern = pattern.replace(
      /id="classPattern"/,
      `id="classPattern" patternTransform="${scaleTransform}"`
    );
  }

  // Adjust opacity
  pattern = pattern.replace(
    /(stroke-opacity|fill-opacity)="([^"]*)"/g,
    (match, p1, p2) => {
      const originalOpacity = parseFloat(p2);
      const newOpacity = clamp(
        originalOpacity * patternOpacityMultiplier,
        0,
        1
      );
      return `${p1}="${newOpacity.toFixed(3)}"`;
    }
  );

  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Angled class gradient (full width) -->
        <linearGradient id="leftBg" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform="rotate(18)">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>

        <!-- Soft vertical sheen -->
        <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>

        <!-- Vignette -->
        <radialGradient id="vign" cx="50%" cy="50%" r="75%">
          <stop offset="70%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
        </radialGradient>

        <!-- Class-specific pattern -->
        ${pattern}

        <!-- Bokeh circles -->
        <radialGradient id="bokeh" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>

      </defs>

      <!-- Base gradient (full width) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#leftBg)"/>

      <!-- Pattern overlay (full width) -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#classPattern)"/>
      <!-- Bokeh accents on left panel area -->
      <circle cx="${Math.round(
        seamX * 0.35
      )}" cy="${Math.round(
    height * 0.28
  )}" r="${Math.round(height * 0.35)}" fill="url(#bokeh)"/>
      <circle cx="${Math.round(
        seamX * 0.58
      )}" cy="${Math.round(
    height * 0.18
  )}" r="${Math.round(height * 0.22)}" fill="url(#bokeh)"/>
      <circle cx="${Math.round(
        seamX * 0.48
      )}" cy="${Math.round(
    height * 0.78
  )}" r="${Math.round(height * 0.18)}" fill="url(#bokeh)"/>

      <!-- Sheen + vignette for depth -->
      <rect width="100%" height="100%" fill="url(#sheen)"/>
      <rect width="100%" height="100%" fill="url(#vign)"/>
    </svg>
  `;
  return Buffer.from(svg);
}

export function createGlassPanelSvg(
  width: number,
  height: number,
  radius: number
): Buffer {
  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panelG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}"
        rx="${radius}" ry="${radius}"
        fill="url(#panelG)"
        stroke="#ffffff" stroke-opacity="0.18" stroke-width="1"/>
    </svg>
  `;
  return Buffer.from(svg);
}

// ---- champion image frame ----

export const getFramePath = (size: number) => {
  const cornerCut = size * 0.08;
  const strokeWidth = 6;
  const halfStroke = strokeWidth / 2;
  return `M ${cornerCut},${halfStroke} L ${size - cornerCut},${halfStroke} L ${
    size - halfStroke
  },${cornerCut} L ${size - halfStroke},${size - cornerCut} L ${ 
    size - cornerCut
  },${size - halfStroke} L ${cornerCut},${size - halfStroke} L ${halfStroke},
    ${size - cornerCut} L ${halfStroke},${cornerCut} Z`;
};

export function createChampionImageFrameSvg(
  size: number,
  primary: string,
  secondary: string
): Buffer {
  const d = getFramePath(size);
  const strokeWidth = 6;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${primary}" />
                <stop offset="100%" stop-color="${secondary}" />
            </linearGradient>
            <filter id="frameGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4.5" flood-color="${primary}" flood-opacity="0.65" />
            </filter>
        </defs>
        <path d="${d}"
            fill="none"
            stroke="url(#frameGrad)"
            stroke-width="${strokeWidth}"
            filter="url(#frameGlow)"
        />
        <path d="${d}"
            fill="none"
            stroke="#ffffff"
            stroke-width="${strokeWidth * 0.25}"
            stroke-opacity="0.4"
        />
    </svg>
    `;
  return Buffer.from(svg);
}

export function createInnerFrameDarkeningSvg(
  size: number,
  primary: string,
  secondary: string
): Buffer {
  const d = getFramePath(size);
  const rightPrimary = adjustColorBrightness(primary, -0.35);
  const rightSecondary = adjustColorBrightness(secondary, -0.45);

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="darkenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${rightPrimary}" stop-opacity="0.55"/>
                <stop offset="100%" stop-color="${rightSecondary}" stop-opacity="0.55"/>
            </linearGradient>
            <clipPath id="frameClip">
                <path d="${d}" />
            </clipPath>
        </defs>
        <rect width="${size}" height="${size}" fill="url(#darkenGrad)" clip-path="url(#frameClip)" />
    </svg>
    `;
  return Buffer.from(svg);
}

// ---- text + pills (title top-left, pills bottom-left) ----

export function createTextAndPillsSvg(opts: {
  title: string;
  subcommand: string;
  width: number;
  height: number;
  padding: number;
  titleRightLimit: number; // panelWidth - padding
  pillsLeft: number; // next to avatar
  pillsBottom: number; // distance from bottom
  chipStart: string; // gradient start for subcommand chip
  chipEnd: string; // gradient end for subcommand chip
  titleAsPaths?: string; // precomputed <path> markup for title when using embedded font
  font: opentype.Font | null;
}): Buffer {
  const {
    title,
    subcommand,
    width,
    height,
    padding,
    titleRightLimit,
    pillsLeft,
    pillsBottom,
    chipStart,
    chipEnd,
    titleAsPaths,
    font,
  } = opts;

  const escapedTitle = escapeXml(title);
  const escapedCmd = escapeXml(subcommand.toUpperCase());

  const measure = (text: string, size: number) => {
    if (!font) return text.length * (size * 0.6); // Fallback
    return font.getAdvanceWidth(text, size);
  };

  // Big title layout (from computeTitleLayout)
  const { lines, fontSize, yTitle, maxTitleWidth } = computeTitleLayout(
    escapedTitle,
    padding,
    titleRightLimit,
    font
  );

  // Helper to gently adjust text to fit width if slightly overflowing
  const makeTextAdjustAttrs = (t: string, s: number, maxW: number) => {
    const est = measure(t, s);
    if (est <= maxW) return "";
    const ratio = est / maxW;
    // Only apply if within 15% overflow to avoid extreme distortion
    if (ratio <= 1.15) {
      return `textLength="${maxW}" lengthAdjust="spacingAndGlyphs"`;
    }
    return "";
  };

  // Pills
  const chipFont = 36;
  const chipPadX = 10; // Base padding
  const chipPadY = 5;
  const letterSpacing = 0; // User can adjust this to control length
  const chipH = chipFont + chipPadY * 2;

  let cmdW: number;
  let subcommandPath = "";

  if (font) {
    // Get a path with letter-spacing to calculate its true advance width.
    // The path's advanceWidth is in font units, so we must scale it to pixels.
    const textPath = font.getPath(escapedCmd, 0, 0, chipFont, {
      letterSpacing,
      kerning: true,
    });
    const textWidth = font.getAdvanceWidth(escapedCmd, chipFont, {
      letterSpacing,
      kerning: true,
    });
    cmdW = textWidth + chipPadX * 2;

    // Create the final path for rendering, positioned correctly inside the pill.
    const x = chipPadX;
    const y = chipPadY + chipFont * 0.8; // Approximation for vertical center
    const renderPath = font.getPath(escapedCmd, x, y, chipFont, {
      letterSpacing,
      kerning: true,
    });
    subcommandPath = `<path d="${renderPath.toPathData(
      2
    )}" fill="#ffffff" filter="url(#titleShadow)"/>`;
  } else {
    // Fallback if font fails to load. Letter-spacing is not supported here.
    cmdW = measure(escapedCmd, chipFont) + chipPadX * 2;
  }

  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="titleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#e5e5e5" />
        </linearGradient>
        <filter id="titleShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.4" />
        </filter>
        <linearGradient id="cmdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${chipStart}" />
          <stop offset="100%" stop-color="${chipEnd}" />
        </linearGradient>
      </defs>
      <style>
        .title {
          font-family: "Bebas Neue", Oswald, Montserrat, system-ui, sans-serif;
          font-weight: 700;
          font-size: ${fontSize}px;
          letter-spacing: 1.5px;
          fill: url(#titleGrad);
        }
      </style>

      ${ 
        titleAsPaths
          ? titleAsPaths
          : lines.length === 1
          ? `<text x="${padding}" y="${yTitle}" class="title" filter="url(#titleShadow)" ${makeTextAdjustAttrs(
              lines[0],
              fontSize,
              maxTitleWidth
            )}>${lines[0]}</text>`
          : `
        <text x="${padding}" y="${ 
              yTitle - (fontSize + 6) / 2
            }" class="title" filter="url(#titleShadow)" ${makeTextAdjustAttrs(
              lines[0],
              fontSize,
              maxTitleWidth
            )}>${lines[0]}</text>
        <text x="${padding}" y="${ 
              yTitle + (fontSize + 6) / 2
            }" class="title" filter="url(#titleShadow)" ${makeTextAdjustAttrs(
              lines[1] ?? "",
              fontSize,
              maxTitleWidth
            )}>${lines[1]}</text>`
      }

      <!-- Pills row (bottom-left, next to avatar) -->
      <g transform="translate(${pillsLeft}, ${height - pillsBottom - chipH})">
        <!-- subcommand chip -->
        <g>
          <rect x="0" y="0" rx="10" ry="10"
            width="${cmdW}" height="${chipH}"
            fill="url(#cmdGrad)" fill-opacity="0.5"
            stroke="#ffffff" stroke-opacity="0.4" stroke-width="1.5"/>
          ${subcommandPath}
        </g>
      </g>
    </svg>
  `;
  return Buffer.from(svg);
}
