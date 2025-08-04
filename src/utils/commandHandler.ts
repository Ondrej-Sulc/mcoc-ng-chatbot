import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Collection } from "discord.js";
import { Command } from "../types/command";

const commandsPath = join(__dirname, "..", "commands");

export const commands = new Collection<string, Command>();

async function findCommandFiles(dir: string): Promise<string[]> {
  const entries = readdirSync(dir);
  const files: string[] = [];
  const isDevelopment = process.env.NODE_ENV === "development";
  const fileExtension = isDevelopment ? ".ts" : ".js";

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      const indexFile = join(fullPath, `index${fileExtension}`);
      try {
        statSync(indexFile); // Check if index file exists
        files.push(indexFile);
      } catch (e) {
        // Not a command directory, ignore
      }
    } else if (entry.endsWith(fileExtension) && entry !== `index${fileExtension}`) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function loadCommands() {
  const commandFiles = await findCommandFiles(commandsPath);

  console.log(`🔎 Found ${commandFiles.length} command files.`);

  for (const filePath of commandFiles) {
    try {
      const commandModule = await import(filePath);
      const command = commandModule.command || commandModule.default;

      if (command && "data" in command && "execute" in command) {
        commands.set(command.data.name, command);
        console.log(`   ✅ Loaded command: /${command.data.name}`);
      } else {
        console.warn(
          `   ⚠️ [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    } catch (error) {
      console.error(`   ❌ Error loading command from ${filePath}:`, error);
    }
  }
}
