import { ChampionClass } from "@prisma/client";

// Class color mappings for MCOC
export const CLASS_COLORS = {
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

export const CLASS_PATTERN_CONFIG: Record<ChampionClass, PatternConfig> = {
  COSMIC: { scale: 1.1, opacity: 2.5 },
  TECH: { scale: 1.5, opacity: 1.25 },
  MUTANT: { scale: 1.25, opacity: 2.5 },
  SKILL: { scale: 1.5, opacity: 1.25 },
  SCIENCE: { scale: 2, opacity: 1.5 },
  MYSTIC: { scale: 1.75, opacity: 1.25 },
  SUPERIOR: { scale: 1.0, opacity: 1.0 },
};

export const CLASS_PATTERNS: Record<ChampionClass, string> = {
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

export const DEFAULTS = {
  width: 700,
  height: 300,
  padding: 28,
  panelRadius: 0,
  avatarRing: 8,
  avatarGlow: 0,
  fetchTimeoutMs: 8000,
};
