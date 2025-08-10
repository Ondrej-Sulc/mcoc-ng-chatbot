import "dotenv/config";

/**
 * Represents the application's configuration.
 */
export interface Config {
  BOT_TOKEN: string;
  OPEN_ROUTER_API_KEY: string;
  OPENROUTER_DEFAULT_MODEL: string;
  GOOGLE_CREDENTIALS_JSON: string;
  MCOC_SHEET_ID: string;
  SCHEDULE_SHEET_ID: string;
  TIMEZONE: string;
  AQ_SLACKER_PING_DELAY_HOURS: number;
  AQ_FINAL_PING_HOURS_BEFORE_END: number;
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
    SCHEDULE_SHEET_ID: process.env.SCHEDULE_SHEET_ID,
  };

  Object.entries(required).forEach(([key, value]) => {
    if (!value) throw new Error(`❌ ${key} is missing`);
  });

  return {
    BOT_TOKEN: getEnv(
      process.env.NODE_ENV === "production"
        ? "DISCORD_BOT_TOKEN_PROD"
        : "DISCORD_BOT_TOKEN_DEV"
    ),
    OPEN_ROUTER_API_KEY: getEnv("OPEN_ROUTER_API_KEY"),
    OPENROUTER_DEFAULT_MODEL: getEnv("OPENROUTER_DEFAULT_MODEL", "google/gemini-2.5-flash"),
    GOOGLE_CREDENTIALS_JSON: getEnv("GOOGLE_CREDENTIALS_JSON"),
    MCOC_SHEET_ID: getEnv("MCOC_SHEET_ID"),
    SCHEDULE_SHEET_ID: getEnv("SCHEDULE_SHEET_ID"),
    TIMEZONE: getEnv("TIMEZONE", "Europe/Prague"),
    AQ_SLACKER_PING_DELAY_HOURS: parseInt(getEnv("AQ_SLACKER_PING_DELAY_HOURS", "8"), 10),
    AQ_FINAL_PING_HOURS_BEFORE_END: parseInt(getEnv("AQ_FINAL_PING_HOURS_BEFORE_END", "3"), 10),
  };
};

export const config: Config = createConfig();
