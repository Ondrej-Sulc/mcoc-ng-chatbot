import { Client, Guild } from "discord.js";
import { getApplicationEmojiMarkupByName } from "../services/applicationEmojiService";

/**
 * Creates a resolver function that rewrites custom emoji markup strings
 * like "<:Name:123>" or "<a:Name:123>" to use the ID of the emoji that
 * exists for the current bot in the current guild (or any guild the bot is in),
 * matching by emoji name. This lets the same stored strings work across prod/dev
 * where IDs differ but names are the same.
 */
export function createEmojiResolver(client: Client, guild: Guild | null): (text: string) => string {
  // Simple per-resolver cache by name to resolved string to avoid repeated lookups
  const nameToMarkupCache = new Map<string, string>();

  function resolveOne(name: string): string | null {
    if (nameToMarkupCache.has(name)) {
      return nameToMarkupCache.get(name)!;
    }

    // Primary source: application-owned emojis (bot application level)
    const fromApp = getApplicationEmojiMarkupByName(name);
    if (fromApp) {
      nameToMarkupCache.set(name, fromApp);
      return fromApp;
    }

    // Fallbacks (in case some emojis are still guild-based): prefer current guild, then any client emoji
    const fromGuild = guild?.emojis.cache.find((e) => e.name === name) || null;
    const fromClient = (fromGuild ?? client.emojis.cache.find((e) => e.name === name)) || null;

    if (!fromClient) {
      nameToMarkupCache.set(name, "");
      return null;
    }

    const markup = fromClient.toString();
    nameToMarkupCache.set(name, markup);
    return markup;
  }

  return function resolveEmojisInText(text: string): string {
    if (!text) return text;

    // Replace any custom emoji-like markup by name. We ignore the stored ID and rebuild from cache.
    return text.replace(/<a?:([A-Za-z0-9_]+):\d+>/g, (_match, p1: string) => {
      const name = p1;
      const resolved = resolveOne(name);
      return resolved ?? _match; // fallback to original if not found
    });
  };
}


