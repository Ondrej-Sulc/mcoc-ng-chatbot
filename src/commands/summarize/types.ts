import { TextChannel, ThreadChannel } from "discord.js";

export interface SummarizeParams {
  channel: TextChannel | ThreadChannel;
  timeframe: string;
  language: string;
  customPrompt?: string;
}
