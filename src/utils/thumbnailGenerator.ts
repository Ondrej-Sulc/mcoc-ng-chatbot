import sharp from "sharp";
import * as opentype from "opentype.js";
import { promises as fs } from "fs";
import path from "path";
import { ChampionClass } from "@prisma/client";

export interface ChampionThumbnailOptions {
  championName: string;
  championClass: ChampionClass;
  secondaryImageUrl: string; // full-body
  primaryImageUrl?: string; // circular avatar
  subcommand: string; // e.g., "abilities"
  tagline?: string; // optional, small text line
  width?: number;
  height?: number;
  fetchTimeoutMs?: number;
  patternScale?: number;
  patternOpacityMultiplier?: number;
}

// Class color mappings for MCOC
const CLASS_COLORS = {
  COSMIC: { primary: "#2dd4d4", secondary: "#0b7d7d" }, // bright cyan → deep teal
  TECH: { primary: "#4a6cf7", secondary: "#1a2e8f" }, // vivid blue → navy
  MUTANT: { primary: "#ffe600", secondary: "#d46f17" },
  SKILL: { primary: "#e63946", secondary: "#8b1e2d" }, // crimson → deep burgundy
  SCIENCE: { primary: "#4ade80", secondary: "#166534" }, // fresh green → forest green
  MYSTIC: { primary: "#c026d3", secondary: "#6b0f7a" }, // magenta → deep purple
  SUPERIOR: { primary: "#20c997", secondary: "#0d5f4a" }, // bright teal-green → deep emerald-teal
} as const;

interface PatternConfig {
  scale: number;
  opacity: number;
}

const CLASS_PATTERN_CONFIG: Record<ChampionClass, PatternConfig> = {
  COSMIC: { scale: 1.1, opacity: 2.5 },
  TECH: { scale: 1.5, opacity: 1.25 },
  MUTANT: { scale: 1.25, opacity: 2.5 },
  SKILL: { scale: 1.5, opacity: 1.25 },
  SCIENCE: { scale: 2, opacity: 1.5 },
  MYSTIC: { scale: 1.75, opacity: 1.25 },
  SUPERIOR: { scale: 1.0, opacity: 1.0 },
};

const CLASS_PATTERNS: Record<ChampionClass, string> = {
  COSMIC: `
  <pattern
    id="classPattern"
    patternUnits="userSpaceOnUse"
    width="100"
    height="100"
    patternTransform="rotate(12)"
  >
    <g stroke="#ffffff" fill="none" stroke-linecap="round">
      <!-- Main swirling paths -->
      <path
        d="M0 25 Q30 5, 50 25 T100 25"
        stroke-width="1.3"
        stroke-opacity="0.1"
      />
      <path
        d="M0 75 Q30 95, 50 75 T100 75"
        stroke-width="1.3"
        stroke-opacity="0.1"
      />
      <path
        d="M10 0 Q5 30, 25 50 T25 100"
        stroke-width="1.1"
        stroke-opacity="0.09"
      />
      <path
        d="M90 0 Q95 30, 75 50 T75 100"
        stroke-width="1.1"
        stroke-opacity="0.09"
      />
      <!-- Secondary, lighter trails -->
      <path
        d="M0 45 Q20 30, 40 45 T100 45"
        stroke-width="0.8"
        stroke-opacity="0.07"
      />
      <path
        d="M0 60 Q20 75, 40 60 T100 60"
        stroke-width="0.8"
        stroke-opacity="0.07"
      />
    </g>

    <g fill="#ffffff">
      <!-- Scattered stars/cosmic dust -->
      <circle cx="15" cy="18" r="1.5" fill-opacity="0.15" />
      <circle cx="85" cy="30" r="1.2" fill-opacity="0.13" />
      <circle cx="30" cy="88" r="1.4" fill-opacity="0.14" />
      <circle cx="60" cy="10" r="1.1" fill-opacity="0.12" />
      <circle cx="5" cy="65" r="1.3" fill-opacity="0.14" />
      <circle cx="95" cy="70" r="1.1" fill-opacity="0.13" />
      <circle cx="45" cy="50" r="1" fill-opacity="0.11" />
      <circle cx="70" cy="40" r="0.9" fill-opacity="0.1" />
    </g>
  </pattern>
  `,
  TECH: `
    <pattern
      id="classPattern"
      patternUnits="userSpaceOnUse"
      width="64"
      height="64"
    >
      <g
        stroke="#ffffff"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M0 16 H28 V28 H44 V48 H64"
          stroke-width="1.4"
          stroke-opacity="0.12"
        />
        <path
          d="M0 36 H16 V20 H36 V8 H64"
          stroke-width="1.2"
          stroke-opacity="0.11"
        />
        <path d="M8 0 V64" stroke-width="1" stroke-opacity="0.09" />
        <path d="M56 0 V64" stroke-width="1" stroke-opacity="0.09" />
        <path
          d="M24 56 H40 V64"
          stroke-width="1"
          stroke-opacity="0.09"
        />
        <path
          d="M0 56 H12 M52 8 H64"
          stroke-width="1"
          stroke-opacity="0.08"
        />
      </g>
      <g fill="#ffffff">
        <circle cx="28" cy="16" r="1.6" fill-opacity="0.18" />
        <circle cx="44" cy="28" r="1.6" fill-opacity="0.18" />
        <circle cx="16" cy="36" r="1.4" fill-opacity="0.16" />
        <circle cx="36" cy="20" r="1.2" fill-opacity="0.14" />
        <circle cx="8" cy="8" r="1" fill-opacity="0.12" />
        <circle cx="56" cy="56" r="1.2" fill-opacity="0.14" />
      </g>
      <g stroke="#ffffff" stroke-opacity="0.1">
        <path
          d="M20 44 h6 m-3 -3 v6"
          stroke-width="0.9"
          fill="none"
        />
        <path
          d="M48 12 h5 m-2.5 -2.5 v5"
          stroke-width="0.9"
          fill="none"
        />
      </g>
    </pattern>
  `,

  MUTANT: `
    <pattern
      id="classPattern"
      patternUnits="userSpaceOnUse"
      width="60"
      height="60"
      patternTransform="rotate(10)"
    >
      <g stroke="#ffffff" fill="none" stroke-linecap="round">
        <!-- Main orbital path -->
        <path d="M30 0 Q50 30 30 60 Q10 30 30 0 Z" stroke-width="1.2" stroke-opacity="0.12"/>
        <!-- Second orbital path, crossing -->
        <path d="M0 30 Q30 50 60 30 Q30 10 0 30 Z" stroke-width="1.2" stroke-opacity="0.12"/>
        <!-- Central nucleus / energy core -->
        <circle cx="30" cy="30" r="4" stroke-width="0.9" stroke-opacity="0.1"/>
        <!-- Subtle energy lines / connections -->
        <path d="M10 10 L50 50 M10 50 L50 10" stroke-width="0.7" stroke-opacity="0.08"/>
      </g>
      <g fill="#ffffff">
        <!-- Electrons / data points -->
        <circle cx="30" cy="0" r="1.5" fill-opacity="0.15"/>
        <circle cx="60" cy="30" r="1.5" fill-opacity="0.15"/>
        <circle cx="30" cy="60" r="1.5" fill-opacity="0.15"/>
        <circle cx="0" cy="30" r="1.5" fill-opacity="0.15"/>
        <circle cx="30" cy="30" r="2.5" fill-opacity="0.18"/> <!-- Central point -->
        <circle cx="15" cy="45" r="1" fill-opacity="0.11"/>
        <circle cx="45" cy="15" r="1" fill-opacity="0.11"/>
      </g>
    </pattern>
  `,

  SKILL: `
    <pattern
      id="classPattern"
      patternUnits="userSpaceOnUse"
      width="32"
      height="32"
      patternTransform="rotate(20)"
    >
      <g
        stroke="#ffffff"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M0 16 L16 0 L32 16 L16 32 Z" stroke-width="1.3" stroke-opacity="0.12"/>
        <path d="M8 8 L24 24 M8 24 L24 8" stroke-width="1" stroke-opacity="0.1"/>
        <circle cx="16" cy="16" r="6" stroke-width="0.8" stroke-opacity="0.09"/>
      </g>
      <g fill="#ffffff">
        <circle cx="16" cy="16" r="1.8" fill-opacity="0.16"/>
        <circle cx="8" cy="8" r="0.9" fill-opacity="0.11"/>
        <circle cx="24" cy="24" r="0.9" fill-opacity="0.11"/>
        <circle cx="8" cy="24" r="0.9" fill-opacity="0.11"/>
        <circle cx="24" cy="8" r="0.9" fill-opacity="0.11"/>
      </g>
    </pattern>
  `,

  SCIENCE: `
        <pattern id="classPattern"
      patternUnits="userSpaceOnUse"
      width="30"
      height="34.64"
    >
      <g stroke="#ffffff" fill="none" stroke-linecap="round"
         stroke-opacity="0.11">
        <path
          d="M0 4.33 L7.5 0 L15 4.33 V13 L7.5 17.32 L0 13 Z"
          stroke-width="1"
        />
        <path
          d="M15 4.33 L22.5 0 L30 4.33 V13 L22.5 17.32 L15 13 Z"
          stroke-width="1"
        />
        <path
          d="M7.5 21.65 L15 17.32 L22.5 21.65 V30 L15 34.64 L7.5 30 Z"
          stroke-width="1"
        />
        <path
          d="M-7.5 21.65 L0 17.32 L7.5 21.65 V30 L0 34.64 L-7.5 30 Z"
          stroke-width="1"
        />
      </g>
    </pattern>
  `,

  MYSTIC: `
    <pattern
      id="classPattern"
      patternUnits="userSpaceOnUse"
      width="32"
      height="32"
      patternTransform="rotate(12)"
    >
      <g
        stroke="#ffffff"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle
          cx="16"
          cy="16"
          r="9"
          stroke-width="1.2"
          stroke-opacity="0.11"
        />
        <path
          d="M16 7 L21 16 L16 25 L11 16 Z"
          stroke-width="0.9"
          stroke-opacity="0.09"
        />
        <path
          d="M16 10 L18 13 M16 22 L18 19 M16 10 L14 13 M16 22 L14 19"
          stroke-width="0.6"
          stroke-opacity="0.08"
        />
      </g>

      <g fill="#ffffff">
        <circle cx="4" cy="4" r="0.9" fill-opacity="0.12" />
        <circle cx="28" cy="4" r="0.9" fill-opacity="0.12" />
        <circle cx="4" cy="28" r="0.9" fill-opacity="0.12" />
        <circle cx="28" cy="28" r="0.9" fill-opacity="0.12" />
        <circle cx="16" cy="16" r="1.2" fill-opacity="0.14" />
      </g>
    </pattern>
  `,

  SUPERIOR: `
    <pattern
      id="classPattern"
      patternUnits="userSpaceOnUse"
      width="40"
      height="40"
      patternTransform="rotate(12)"
    >
      <g stroke="#ffffff" fill="none" stroke-linecap="round">
        <path
          d="M0 20 L10 10 L20 20 L30 10 L40 20"
          stroke-width="1.2"
          stroke-opacity="0.1"
        />
        <path
          d="M0 30 L10 20 L20 30 L30 20 L40 30"
          stroke-width="1"
          stroke-opacity="0.08"
        />
        <path
          d="M20 0 L30 10 L20 20 L10 10 Z"
          stroke-width="1"
          stroke-opacity="0.09"
        />
      </g>
      <g fill="#ffffff">
        <circle cx="20" cy="20" r="1.3" fill-opacity="0.14" />
      </g>
    </pattern>
  `,
};

const DEFAULTS = {
  width: 700,
  height: 300,
  padding: 28,
  panelRadius: 0,
  avatarRing: 8,
  avatarGlow: 0,
  fetchTimeoutMs: 8000,
};

// ---- utils ----

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

function hexToRgba(hex: string): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const clean = hex.replace(/^#/, "");
  const hasAlpha = clean.length === 8;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const a = hasAlpha ? parseInt(clean.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

function rgbaToHex(r: number, g: number, b: number, a: number = 255): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

function adjustColorBrightness(hex: string, factor: number): string {
  const { r, g, b, a } = hexToRgba(hex);
  const adj = (v: number) =>
    v + (factor >= 0 ? (255 - v) * factor : v * factor);
  return rgbaToHex(adj(r), adj(g), adj(b), a);
}

async function fetchArrayBufferWithTimeout(
  url: string,
  timeoutMs: number
): Promise<ArrayBuffer> {
  const { default: fetch } = await import("node-fetch");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "mcoc-bot-thumbnail/1.0" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

let cachedTitleFont: opentype.Font | null = null;

function nodeBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice().buffer;
}

async function loadTitleFont(): Promise<opentype.Font | null> {
  try {
    if (cachedTitleFont) return cachedTitleFont;
    const localTtf = path.resolve(
      process.cwd(),
      "assets/fonts/BebasNeue-Regular.ttf"
    );
    const local = await fs.readFile(localTtf);
    const font = opentype.parse(nodeBufferToArrayBuffer(local));
    cachedTitleFont = font;
    return font;
  } catch {
    return null;
  }
}

function computeTitleLayout(
  title: string,
  padding: number,
  titleRightLimit: number,
  font: opentype.Font | null
): {
  lines: string[];
  fontSize: number;
  yTitle: number;
  maxTitleWidth: number;
} {
  const maxTitleWidth = titleRightLimit - padding;
  const baseSize = 72;
  const minSize = 26;

  const measure = (text: string, size: number) => {
    if (!font) return text.length * (size * 0.6); // Fallback
    return font.getAdvanceWidth(text, size);
  };

  // Find optimal font size for a single line
  let fontSize = baseSize;
  for (let s = baseSize; s >= minSize; s--) {
    if (measure(title, s) <= maxTitleWidth) {
      fontSize = s;
      break;
    }
    if (s === minSize) {
      fontSize = minSize;
    }
  }

  let lines: string[] = [title];
  // if it still doesn't fit at minSize, we must wrap
  if (measure(title, fontSize) > maxTitleWidth) {
    const words = title.split(/\s+/);
    let line1 = "";
    let line2 = "";

    // Greedy word wrap
    for (const w of words) {
      const testLine = line1 ? `${line1} ${w}` : w;
      if (measure(testLine, minSize) <= maxTitleWidth) {
        // use minSize for wrapping decision
        line1 = testLine;
      } else {
        line2 = line2 ? `${line2} ${w}` : w;
      }
    }

    // Handle cases where a single word is too long
    if (!line1) {
      line1 = words[0];
      line2 = words.slice(1).join(" ");
    }

    lines = [line1, line2.trim()].filter(Boolean);
    if (lines.length > 1) {
      const longerLine =
        measure(lines[0], 100) > measure(lines[1], 100) ? lines[0] : lines[1];
      // Recalculate font size for the wrapped lines
      for (let s = baseSize; s >= minSize; s--) {
        if (measure(longerLine, s) <= maxTitleWidth) {
          fontSize = s;
          break;
        }
        if (s === minSize) {
          fontSize = minSize;
        }
      }
    }
  }

  const yTitle = padding + fontSize;
  return { lines, fontSize, yTitle, maxTitleWidth };
}

function buildTitlePathsMarkup(
  font: opentype.Font,
  lines: string[],
  fontSize: number,
  padding: number,
  yTitle: number,
  maxTitleWidth: number
): string {
  const makePath = (text: string) => {
    const advance = font.getAdvanceWidth(text, fontSize, { kerning: true });
    const scale = advance > 0 ? Math.min(1, maxTitleWidth / advance) : 1;
    const yBaseline = yTitle; // baseline already computed upstream
    const path = font.getPath(text, 0, 0, fontSize);
    const d = path.toPathData(2);
    return `<g transform="translate(${padding}, ${yBaseline}) scale(${scale}) skewX(-5)">
      <path d="${d}" fill="url(#titleGrad)" filter="url(#titleShadow)"/>
    </g>`;
  };

  if (lines.length === 1) {
    return makePath(lines[0]);
  }
  const gap = 12; // increase line gap for better readability with outline
  const topY = yTitle - (fontSize + gap) / 2;
  const botY = yTitle + (fontSize + gap) / 2;
  // For two-line, rebuild with specific y baselines
  const makePathAtY = (text: string, y: number) => {
    const advance = font.getAdvanceWidth(text, fontSize, { kerning: true });
    const scale = advance > 0 ? Math.min(1, maxTitleWidth / advance) : 1;
    const path = font.getPath(text, 0, 0, fontSize);
    const d = path.toPathData(2);
    return `<g transform="translate(${padding}, ${y}) scale(${scale}) skewX(-5)">
      <path d="${d}" fill="url(#titleGrad)" filter="url(#titleShadow)"/>
    </g>`;
  };
  return `${makePathAtY(lines[0], topY)}${makePathAtY(lines[1], botY)}`;
}

// ---- background (consistent, full-canvas) ----

function createBackgroundSvg(
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
      <circle cx="${Math.round(seamX * 0.35)}" cy="${Math.round(
    height * 0.28
  )}" r="${Math.round(height * 0.35)}" fill="url(#bokeh)"/>
      <circle cx="${Math.round(seamX * 0.58)}" cy="${Math.round(
    height * 0.18
  )}" r="${Math.round(height * 0.22)}" fill="url(#bokeh)"/>
      <circle cx="${Math.round(seamX * 0.48)}" cy="${Math.round(
    height * 0.78
  )}" r="${Math.round(height * 0.18)}" fill="url(#bokeh)"/>

      <!-- Sheen + vignette for depth -->
      <rect width="100%" height="100%" fill="url(#sheen)"/>
      <rect width="100%" height="100%" fill="url(#vign)"/>
    </svg>
  `;
  return Buffer.from(svg);
}

function createGlassPanelSvg(
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

const getFramePath = (size: number) => {
  const cornerCut = size * 0.08;
  const strokeWidth = 6;
  const halfStroke = strokeWidth / 2;
  return `M ${cornerCut},${halfStroke} L ${size - cornerCut},${halfStroke} L ${
    size - halfStroke
  },${cornerCut} L ${size - halfStroke},${size - cornerCut} L ${
    size - cornerCut
  },${size - halfStroke} L ${cornerCut},${size - halfStroke} L ${halfStroke},${
    size - cornerCut
  } L ${halfStroke},${cornerCut} Z`;
};

function createChampionImageFrameSvg(
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

function createInnerFrameDarkeningSvg(
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

function createTextAndPillsSvg(opts: {
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

// ---- avatar ----

async function createCircularAvatar(opts: {
  image: Buffer;
  diameter: number;
  ringWidth: number;
  ringStart: string;
  ringEnd: string;
}): Promise<Buffer> {
  const { image, diameter, ringWidth, ringStart, ringEnd } = opts;
  const padding = 10; // Px padding to allow glow to render
  const canvasSize = diameter + padding * 2;
  const r = diameter / 2;
  const cx = r + padding;
  const cy = r + padding;
  const innerR = r - ringWidth / 2;

  const avatar = await sharp(image)
    .resize(diameter, diameter, { fit: "cover" })
    .toBuffer();

  const mask = Buffer.from(`
    <svg width="${diameter}" height="${diameter}"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>
    </svg>
  `);

  const ring = Buffer.from(`
    <svg width="${canvasSize}" height="${canvasSize}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${ringStart}"/>
          <stop offset="100%" stop-color="${ringEnd}"/>
        </linearGradient>
        <filter id="avatarGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="${ringStart}" flood-opacity="0.65" />
        </filter>
      </defs>
      <g filter="url(#avatarGlow)">
        <circle cx="${cx}" cy="${cy}" r="${innerR}"
          fill="none" stroke="url(#ring)" stroke-width="${ringWidth}"/>
        <circle cx="${cx}" cy="${cy}" r="${innerR}"
          fill="none" stroke="#ffffff" stroke-width="${
            ringWidth * 0.25
          }" stroke-opacity="0.4"/>
      </g>
    </svg>
  `);

  const masked = await sharp(avatar)
    .composite([{ input: mask, blend: "dest-in" }])
    .toBuffer();

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: masked, top: padding, left: padding },
      { input: ring, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

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
