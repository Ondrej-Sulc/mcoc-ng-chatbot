export type PrestigeResult = {
  success: boolean;
  summonerPrestige: number;
  championPrestige: number;
  relicPrestige: number;
  fallback?: boolean;
  error?: string;
  debugInfo?: {
    croppedImage?: Buffer;
    cropAttempt?: {
      text?: string;
      detectedLabels?: { summoner: number; champion: number; relic: number };
      error?: string;
      extracted?: {
        labels: { text: string; bounds: any }[];
        numbers: { value: number; bounds: any }[];
      };
    };
    fullAttempt?: {
      text?: string;
      detectedLabels?: { summoner: number; champion: number; relic: number };
      error?: string;
      extracted?: {
        labels: { text: string; bounds: any }[];
        numbers: { value: number; bounds: any }[];
      };
    };
  };
};

export type OCRResult = {
  summoner: number;
  champion: number;
  relic: number;
};
