import "dotenv/config";

interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

/**
 * Represents the application's configuration.
 */
export interface Config {
  BOT_TOKEN: string;
  OPEN_ROUTER_API_KEY: string;
  OPENROUTER_DEFAULT_MODEL: string;
  GOOGLE_CREDENTIALS: GoogleCredentials;
  MCOC_SHEET_ID: string;
  TIMEZONE: string;
  AQ_SLACKER_PING_DELAY_HOURS: number;
  AQ_FINAL_PING_HOURS_BEFORE_END: number;
  DEV_USER_IDS: string[];

  // Alliance War Settings
  allianceWar: {
    battlegroupChannelMappings: Record<string, { sheet: string; color: number; }>;
    dataRange: string;
    descriptionCol: number;
    nodeCol: number;
    playerCol: number;
    defenderCol: number;
    attackerCol: number;
    PreFightTacticDataRange: string,
    PreFightPlayerCol: number,
    PreFightChampionCol: number,
    PreFightDescriptionCol: number,
    TacticAttackCol: number,
    TacticDefenseCol: number,
    nodesRange: string;
  }
}

function getEnv(key: string, defaultValue?: string): string {
  /**
   * Retrieves an environment variable by its key, throwing an error if it's not set.
   * @param key - The key of the environment variable.
   * @param defaultValue - A default value to use if the environment variable is not set.
   * @returns The value of the environment variable.
   * @throws Will throw an error if the environment variable is not set and no default value is provided.
   */
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

const createConfig = (): Config => {
  /**
   * Creates the configuration object by loading and validating environment variables.
   * @returns The application configuration object.
   * @throws Will throw an error if any required environment variables are missing.
   */
  const required = {
    DISCORD_BOT_TOKEN_PROD: process.env.DISCORD_BOT_TOKEN_PROD,
    DISCORD_BOT_TOKEN_DEV: process.env.DISCORD_BOT_TOKEN_DEV,
    OPEN_ROUTER_API_KEY: process.env.OPEN_ROUTER_API_KEY,
    GOOGLE_CREDENTIALS_JSON: process.env.GOOGLE_CREDENTIALS_JSON,
    MCOC_SHEET_ID: process.env.MCOC_SHEET_ID,
  };

  Object.entries(required).forEach(([key, value]) => {
    if (!value) throw new Error(`❌ ${key} is missing`);
  });

  let credentials;
  try {
    const credentialsJson = getEnv("GOOGLE_CREDENTIALS_JSON");
    const decodedCredentialsString = Buffer.from(
      credentialsJson,
      "base64"
    ).toString("utf8");
    credentials = JSON.parse(decodedCredentialsString);
  } catch (error) {
    console.error(
      `Error loading/parsing Google credentials from environment variable:`,
      error
    );
    throw new Error(
      `Failed to load Google credentials. Check the GOOGLE_CREDENTIALS_JSON environment variable.`
    );
  }

  return {
    BOT_TOKEN: getEnv(
      process.env.NODE_ENV === "production"
        ? "DISCORD_BOT_TOKEN_PROD"
        : "DISCORD_BOT_TOKEN_DEV"
    ),
    OPEN_ROUTER_API_KEY: getEnv("OPEN_ROUTER_API_KEY"),
    OPENROUTER_DEFAULT_MODEL: getEnv("OPENROUTER_DEFAULT_MODEL", "google/gemini-2.5-flash"),
    GOOGLE_CREDENTIALS: credentials,
    MCOC_SHEET_ID: getEnv("MCOC_SHEET_ID"),
    TIMEZONE: getEnv("TIMEZONE", "Europe/Prague"),
    AQ_SLACKER_PING_DELAY_HOURS: parseInt(getEnv("AQ_SLACKER_PING_DELAY_HOURS", "11"), 10),
    AQ_FINAL_PING_HOURS_BEFORE_END: parseInt(getEnv("AQ_FINAL_PING_HOURS_BEFORE_END", "4"), 10),
    DEV_USER_IDS: getEnv("DEV_USER_IDS", '').split(',').filter(Boolean),

    // Alliance War Settings
    allianceWar: {
      battlegroupChannelMappings: {
        "1176169292241309776": { sheet: "AW BG1", color: 0xC62828 }, // Red
        "1176169440107307008": { sheet: "AW BG2", color: 0x388E3C }, // Green
        "1227167947458482206": { sheet: "AW BG3", color: 0x1565C0 }  // Blue
      },
      dataRange: 'FB3:FF52',
      descriptionCol: 0,
      nodeCol: 1,
      playerCol: 2,
      defenderCol: 3,
      attackerCol: 4,
      PreFightTacticDataRange: 'GD3:GH52',
      PreFightPlayerCol: 0,
      PreFightChampionCol: 1,
      PreFightDescriptionCol: 2,
      TacticAttackCol: 3,
      TacticDefenseCol: 4,
      nodesRange: 'AWNodes',
    }
  };
};

export const config: Config = createConfig();
