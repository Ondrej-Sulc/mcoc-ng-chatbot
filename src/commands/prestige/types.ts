export type PrestigeResult = {
  success: boolean;
  summonerPrestige?: number;
  championPrestige?: number;
  relicPrestige?: number;
  fallback?: boolean;
  error?: string;
  debugInfo?: {
    croppedImage?: Buffer;
    cropAttempt?: {
      text?: string;
      detectedLabels?: { summoner: number; champion: number; relic: number };
      error?: string;
    };
    fullAttempt?: {
      text?: string;
      detectedLabels?: { summoner: number; champion: number; relic: number };
      error?: string;
    };
  };
};

export type OCRResult = {
  summoner: number;
  champion: number;
  relic: number;
};
