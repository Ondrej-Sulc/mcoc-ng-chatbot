import { readdirSync } from "node:fs"; // Node.js file system module
import { join } from "node:path"; // Node.js path module
import { Collection } from "discord.js";
import { Command } from "../types/command";
import { config } from "../config"; // Importing the configuration

const commandsPath = join(__dirname, "..", "commands");

export const commands = new Collection<string, Command>();
/**
 * A collection of all the bot's commands.
 */

export async function loadCommands() {
  /**
   * Loads all the commands from the commands directory.
   */
  const isDevelopment = process.env.NODE_ENV === "development";

  const fileExtension = isDevelopment ? ".ts" : ".js";
  const commandFiles = readdirSync(commandsPath).filter((file) =>
    file.endsWith(fileExtension)
  );

  console.log(`🔎 Found ${commandFiles.length} command files.`);

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    try {
      const commandModule = await import(filePath);

      const command = commandModule.command;

      if (command && "data" in command && "execute" in command) {
        commands.set(command.data.name, command);
        console.log(`   ✅ Loaded command: /${command.data.name}`);
      } else {
        console.warn(
          `   ⚠️ [WARNING] The command at ${filePath} is missing a named 'command' export or is improperly structured.`
        );
      }
    } catch (error) {
      console.error(`   ❌ Error loading command from ${filePath}:`, error);
    }
  }
}