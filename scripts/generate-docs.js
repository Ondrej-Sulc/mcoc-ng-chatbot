const fs = require("node:fs");
const path = require("node:path");

// Define output paths
const botDataDir = path.resolve(__dirname, "..", "src", "data");
const botOutputPath = path.join(botDataDir, "commands.json");
const webDataDir = path.resolve(__dirname, "..", "web", "src", "lib", "data");
const webOutputPath = path.join(webDataDir, "commands.json");

const commandsPath = path.resolve(__dirname, "..", "dist", "commands");

function findCommandFiles(dir) {
  const entries = fs.readdirSync(dir);
  const files = [];
  const fileExtension = ".js";

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const indexFile = path.join(fullPath, `index${fileExtension}`);
      try {
        if (fs.statSync(indexFile).isFile()) {
          files.push(indexFile);
        }
      } catch (e) {
        files.push(...findCommandFiles(fullPath));
      }
    }
  }
  return files;
}

async function generateDocs() {
  console.log("\nStarting documentation generation from compiled output...");

  if (!fs.existsSync(commandsPath)) {
    console.error(`\n❌ Error: The 'dist' directory does not exist. Please compile the project first (e.g., with 'npm run build').`);
    process.exit(1);
  }

  const commandFiles = findCommandFiles(commandsPath);
  const allDocs = [];

  console.log(`-> Found ${commandFiles.length} command files to process.`);

  for (const filePath of commandFiles) {
    try {
      const commandModule = require(filePath);
      const command = commandModule.command || commandModule.default;

      if (command && command.data && command.help) {
        const commandData = command.data.toJSON();

        const doc = {
          name: commandData.name,
          description: commandData.description,
          access: command.access,
          group: command.help.group,
          color: command.help.color || "gray",
          image: command.help.image,
          options: commandData.options || [],
          subcommands: command.help.subcommands || {},
        };

        allDocs.push(doc);
        console.log(`   ✅ Processed: /${commandData.name}`);
      } else {
        console.warn(
          `   ⚠️  Command at ${filePath} is missing "data" or "help" property. Skipping.`
        );
      }
    } catch (error) {
      console.error(`   ❌ Error processing file ${filePath}:`, error);
    }
  }

  allDocs.sort((a, b) => a.name.localeCompare(b.name));

  try {
    // Ensure directories exist
    if (!fs.existsSync(botDataDir)) fs.mkdirSync(botDataDir, { recursive: true });
    if (!fs.existsSync(webDataDir)) fs.mkdirSync(webDataDir, { recursive: true });

    const jsonData = JSON.stringify(allDocs, null, 2);

    fs.writeFileSync(botOutputPath, jsonData);
    fs.writeFileSync(webOutputPath, jsonData);

    console.log(`\n🎉 Successfully generated documentation for ${allDocs.length} commands.`);
    console.log(`   -> Bot output: ${botOutputPath}`);
    console.log(`   -> Web output: ${webOutputPath}\n`);
  } catch (error) {
    console.error("\n❌ Failed to write documentation files:", error);
  }
}

generateDocs();
