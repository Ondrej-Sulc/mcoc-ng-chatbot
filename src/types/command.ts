import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AutocompleteInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  AttachmentBuilder,
} from "discord.js";

export interface CommandExecuteParams {
  interaction: ChatInputCommandInteraction;
  userId: string;
  guildId?: string;
}

export interface CommandResult {
  content?: string;
  components?: any;
  embeds?: any;
  files?: AttachmentBuilder[];
  isComponentsV2?: boolean;
  flags?: number;
}

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  cooldown?: number;
  subcommands?: Record<
    string,
    {
      execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
      autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
    }
  >;
}