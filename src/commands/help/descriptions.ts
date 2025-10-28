import { CommandAccess } from "../../types/command";

export interface SubcommandInfo {
  description: string;
  usage?: string;
  filters?: Map<string, string>;
  andOrLogic?: string;
  examples?: string[];
  image?: string;
}

export interface CommandInfo {
  description: string;
  access: CommandAccess;
  group?:
    | "Information & Search"
    | "User Management"
    | "Alliance Tools"
    | "Utilities";
  subcommands: Map<string, SubcommandInfo>;
}

export const commandDescriptions = new Map<string, CommandInfo>([
  [
    "admin",
    {
      description:
        "Administrative commands for managing champions, abilities, attacks, and the glossary. These commands are typically restricted to bot administrators and are used for data management and bot configuration.",
      access: CommandAccess.BOT_ADMIN,
      subcommands: new Map([
        [
          "champion",
          {
            description:
              "Admin commands for managing champions, including adding new champions, updating their images and tags, and syncing data from external sources.",
            usage: "/admin champion <subcommand>",
            examples: [
              "/admin champion add - Initiates a multi-step process to add a new champion to the database. This involves providing basic champion information, image URLs, and prestige data.",
              "/admin champion update_images name:Hercules primary_image:https://example.com/herc_primary.png - Updates Hercules' primary image.",
              "/admin champion update_images name:Iron Man (Infinity War) hero_image:https://example.com/im_iw_hero.png - Updates Iron Man (Infinity War)'s hero image.",
              "/admin champion update_tags name:Captain America (WWII) tags_image:https://example.com/cap_wwii_tags.png - Updates Captain America (WWII)'s tags.",
              "/admin champion sync-sheet - Exports all champion data to the Google Sheet.",
            ],
          },
        ],
        [
          "ability",
          {
            description:
              "Admin commands for managing champion abilities and immunities, including adding, removing, and drafting them using AI.",
            usage: "/admin ability <subcommand>",
            examples: [
              "/admin ability add champion:Hercules type:Ability ability:Immortal Will source:Signature Ability - Adds Immortal Will ability to Hercules.",
              "/admin ability add champion:Colossus type:Immunity ability:Bleed - Adds Bleed immunity to Colossus.",
              "/admin ability remove champion:Hercules type:Ability ability:Immortal Will source:Signature Ability - Removes Immortal Will ability from Hercules.",
              "/admin ability remove champion:Colossus type:Immunity ability:Bleed - Removes Bleed immunity from Colossus.",
              "/admin ability draft champion:Doctor Doom - Drafts abilities for Doctor Doom using the default AI model.",
              "/admin ability draft champion:Kitty Pryde model:google/gemini-2.5-pro - Drafts abilities for Kitty Pryde using a specific AI model.",
            ],
          },
        ],
        [
          "attack",
          {
            description: "Admin commands for managing champion attack data.",
            usage: "/admin attack add <champion>",
            examples: [
              "/admin attack add champion:Human Torch - Opens a modal to add/update Human Torch's attack data.",
            ],
          },
        ],
        [
          "glossary",
          {
            description:
              "Admin commands for managing glossary entries, including linking abilities to categories, unlinking them, and updating descriptions for abilities and categories.",
            usage: "/admin glossary <subcommand>",
            examples: [
              "/admin glossary link ability:Bleed category:Debuffs - Links the Bleed ability to the Debuffs category.",
              "/admin glossary unlink ability:Bleed category:Debuffs - Unlinks the Bleed ability from the Debuffs category.",
              "/admin glossary update-ability ability:Stun description:Prevents the opponent from acting for a short duration. - Updates the description for Stun.",
              "/admin glossary update-category category:Buffs description:Positive effects that enhance a champion's abilities. - Updates the description for Buffs category.",
            ],
          },
        ],
        [
          "duel",
          {
            description: "Admin commands for managing duel data.",
            usage: "/admin duel upload",
            examples: [
              "/admin duel upload file:<duels.csv> - Uploads a CSV file with duel targets.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "aq",
    {
      description:
        "Alliance Quest (AQ) utilities. These commands help alliances coordinate and track their progress in Alliance Quests.",
      access: CommandAccess.USER,
      group: "Alliance Tools",
      subcommands: new Map([
        [
          "start",
          {
            description:
              "Start a new AQ tracker. This initializes the AQ state, sets up the map, and allows members to update their progress.",
            usage: "/aq start <day> <role> [channel] [create_thread]",
            examples: [
              "/aq start day:1 role:BattleGroup1 - Starts an AQ tracker for Day 1, assigning BattleGroup1 role members.",
              "/aq start day:2 role:BattleGroup2 channel:#aq-discussion create_thread:true - Starts an AQ tracker for Day 2 in #aq-discussion, creating a thread for updates.",
            ],
          },
        ],
        [
          "end",
          {
            description:
              "End the active AQ tracker in a channel. This finalizes the AQ state and stops tracking.",
            usage: "/aq end [channel]",
            examples: [
              "/aq end - Ends the active AQ tracker in the current channel.",
              "/aq end channel:#aq-discussion - Ends the active AQ tracker in #aq-discussion.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "aw",
    {
      description: "Commands for Alliance War planning and details.",
      access: CommandAccess.FEATURE,
      group: "Alliance Tools",
      subcommands: new Map([
        [
          "plan",
          {
            description:
              "Sends Alliance War plan details from a Google Sheet to player threads. You can specify a battlegroup, a target player, and an optional image to include with the plan.",
            usage: "/aw plan <battlegroup> [player] [image]",
            examples: [
              "/aw plan battlegroup:1 - Sends the plan for Battlegroup 1 to all relevant player threads.",
              "/aw plan battlegroup:2 player:@User image:<attachment> - Sends the plan for Battlegroup 2 to @User's thread with an attached image.",
            ],
          },
        ],
        [
          "details",
          {
            description:
              "Get detailed information about your Alliance War assignments. This command should be used within a player's war thread.",
            usage: "/aw details [node]",
            examples: [
              "/aw details - Shows all your AW assignments in the current war thread.",
              "/aw details node:5 - Shows details for your assignment on Node 5.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "champion",
    {
      description:
        "Get detailed information about any champion in the game. This acts as a comprehensive in-game encyclopedia for all champions.",
      access: CommandAccess.PUBLIC,
      group: "Information & Search",
      subcommands: new Map([
        [
          "info",
          {
            description:
              "Display a champion's core details and full abilities, including their signature ability and detailed ability breakdowns.",
            usage: "/champion info <champion>",
            examples: [
              "/champion info champion:Spider-Man (Stark Enhanced) - Get basic info and full abilities for Stark Spider-Man.",
            ],
          },
        ],
        [
          "attacks",
          {
            description:
              "Display a champion's attack types and properties, showing details for basic, special, and heavy attacks.",
            usage: "/champion attacks <champion>",
            examples: [
              "/champion attacks champion:Human Torch - View Human Torch's attack types and properties.",
            ],
          },
        ],
        [
          "abilities",
          {
            description:
              "List all of a champion's abilities, including their sources (e.g., Signature Ability, SP1, Synergy).",
            usage: "/champion abilities <champion>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/abilities_hulkling.png",
          },
        ],
        [
          "immunities",
          {
            description:
              "List all of a champion's immunities to various debuffs and effects (e.g., Bleed, Incinerate, Poison), including their sources.",
            usage: "/champion immunities <champion>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/immunities_onslaught.png",
          },
        ],
        [
          "tags",
          {
            description:
              "List all of a champion's tags (e.g., #Metal, #Villain, #Tech, #Hero, #Mystic). Tags are used for synergies and specific quest nodes.",
            usage: "/champion tags <champion>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/tags_dracula.png",
          },
        ],
        [
          "overview",
          {
            description:
              "Display a comprehensive overview of a champion, combining their abilities, immunities, attacks, and tags in a single view.",
            usage: "/champion overview <champion>",
            examples: [
              "/champion overview champion:Kitty Pryde - Get a complete summary for Kitty Pryde.",
            ],
          },
        ],
        [
          "duel",
          {
            description:
              "Get duel targets for a champion. This provides a list of players to duel against for practice.",
            usage: "/champion duel <champion>",
            examples: [
              "/champion duel champion:Absorbing Man - Get duel targets for Absorbing Man.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "debug",
    {
      description:
        "Debugging commands, restricted to bot administrators. These commands are used for testing and troubleshooting bot features.",
      access: CommandAccess.BOT_ADMIN,
      subcommands: new Map([
        [
          "roster",
          {
            description:
              "Debugs the roster processing from one or more screenshots. This command will attempt to extract champion data from the provided images and display the debug output.",
            usage: "/debug roster <image1> [image2] [image3] [image4] [image5]",
            examples: [
              "/debug roster image1:<screenshot.png> - Processes a single roster screenshot in debug mode.",
              "/debug roster image1:<ss1.png> image2:<ss2.png> - Processes multiple roster screenshots in debug mode.",
            ],
          },
        ],
        [
          "prestige",
          {
            description:
              "Debugs prestige extraction from a screenshot. This command will attempt to extract prestige values from the provided image and display detailed OCR debug information.",
            usage: "/debug prestige <image> [player]",
            examples: [
              "/debug prestige image:<profile.png> - Processes a prestige screenshot in debug mode.",
              "/debug prestige image:<profile.png> player:@User - Processes a prestige screenshot for a specific player in debug mode.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "glossary",
    {
      description:
        "Look up MCOC effects, buffs, and debuffs. This acts as an in-game dictionary for various terms.",
      access: CommandAccess.PUBLIC,
      group: "Information & Search",
      subcommands: new Map([
        [
          "effect",
          {
            description:
              "Look up a specific effect by name to see its description, associated categories, and a list of champions that have or are immune to this effect. Provides detailed information about the effect's mechanics.",
            usage: "/glossary effect <effect>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/glossary_effect_crush.png",
          },
        ],
        [
          "category",
          {
            description:
              "List all effects within a specific category (e.g., Buffs, Debuffs, Immunities). This helps in exploring related effects and their descriptions.",
            usage: "/glossary category <category>",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/glossary_category_auto-block.png",
          },
        ],
        [
          "list",
          {
            description:
              "List all available effect categories in the glossary. This provides an overview of the types of effects tracked by the bot, with interactive buttons to view effects within each category.",
            usage: "/glossary list",
            image: "https://storage.googleapis.com/champion-images/feature-showcase/glossary_list.png",
          },
        ],
      ]),
    },
  ],
  [
    "prestige",
    {
      description:
        "Extract prestige values from an MCOC screenshot or view the leaderboard.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "update",
          {
            description:
              "Update your prestige values by uploading a screenshot of your in-game profile. The bot will use OCR to extract Summoner, Champion, and Relic prestige. You can optionally specify a player to update for (admin/moderator only).",
            usage: "/prestige update <image> [player]",
            examples: [
              "/prestige update image:<my_profile.png> - Updates your own prestige using the provided screenshot.",
              "/prestige update image:<ally_profile.png> player:@Ally - Updates @Ally's prestige using the provided screenshot (if authorized).",
            ],
          },
        ],
        [
          "leaderboard",
          {
            description:
              "View the server prestige leaderboard. You can switch between Summoner, Champion, and Relic prestige leaderboards using interactive buttons.",
            usage: "/prestige leaderboard",
            examples: [
              "/prestige leaderboard - Shows the current server prestige leaderboard.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "profile",
    {
      description:
        "Manage your player profile. This command allows you to register your in-game name with the bot.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "register",
          {
            description:
              "Register your in-game name with the bot. This is required to use many of the bot's features, such as roster management and prestige tracking.",
            usage: "/profile register <name>",
            examples: [
              '/profile register name:MyIGN - Registers your in-game name as "MyIGN".',
            ],
          },
        ],
      ]),
    },
  ],
  [
    "roster",
    {
      description:
        "Manage your MCOC roster. Keep track of your champions, their ranks, awakened status, and ascension levels.",
      access: CommandAccess.USER,
      group: "User Management",
      subcommands: new Map([
        [
          "update",
          {
            description:
              "Update your roster by uploading one or more screenshots of your champion list. The bot will use OCR to detect champions, their star level, and awakened status. You must specify the star level and rank of the champions in the screenshot(s).",
            usage:
              "/roster update <stars> <rank> <image1> [is_ascended] [image2] [image3] [image4] [image5] [player]",
            examples: [
              "/roster update stars:6 rank:5 image1:<screenshot.png> - Updates your 6-star, Rank 5 champions from the screenshot.",
              "/roster update stars:7 rank:1 image1:<screenshot.png> is_ascended:true - Updates your 7-star, Rank 1 ascended champions.",
              "/roster update stars:5 rank:5 image1:<ss1.png> image2:<ss2.png> player:@Ally - Updates @Ally's 5-star, Rank 5 champions from multiple screenshots.",
            ],
          },
        ],
        [
          "view",
          {
            description:
              "View a player's roster. You can filter by star level, rank, ascended status, and specify a player whose roster to view.",
            usage: "/roster view [stars] [rank] [is_ascended] [player]",
            examples: [
              "/roster view - Shows your entire roster.",
              "/roster view stars:6 rank:5 - Shows your 6-star, Rank 5 champions.",
              "/roster view is_ascended:true player:@Ally - Shows @Ally's ascended champions.",
            ],
          },
        ],
        [
          "delete",
          {
            description:
              "Delete champions from a player's roster. You can delete specific champions by name, or filter by star level, rank, or ascended status. If no options are provided, it will prompt to delete the entire roster.",
            usage:
              "/roster delete [champion] [stars] [rank] [is_ascended] [player]",
            examples: [
              "/roster delete champion:Iron Man - Deletes Iron Man from your roster.",
              "/roster delete stars:2 - Deletes all 2-star champions from your roster.",
              "/roster delete player:@Ally - Prompts to delete @Ally's entire roster.",
            ],
          },
        ],
        [
          "summary",
          {
            description:
              "Display a summary of a player's roster, grouped by star level, rank, and class. You can specify a player whose roster to summarize.",
            usage: "/roster summary [player]",
            examples: [
              "/roster summary - Shows a summary of your roster.",
              "/roster summary player:@Ally - Shows a summary of @Ally's roster.",
            ],
          },
        ],
        [
          "export",
          {
            description:
              "Export a player's roster to a CSV file. The CSV file will be sent as an attachment.",
            usage: "/roster export [player]",
            examples: [
              "/roster export - Exports your roster to a CSV file.",
              "/roster export player:@Ally - Exports @Ally's roster to a CSV file.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "schedule",
    {
      description:
        "Manage scheduled tasks. You can add, list, and remove scheduled messages or command executions.",
      access: CommandAccess.PUBLIC,
      group: "Utilities",
      subcommands: new Map([
        [
          "add",
          {
            description:
              "Add a new scheduled task. You can schedule a custom message or a bot command to be sent to a specific channel or user at a defined frequency and time. Supports daily, weekly, monthly, and custom cron frequencies.",
            usage:
              "/schedule add <name> <frequency> <time> [command] [message] [target_channel_id] [target_user_id] [day] [interval] [unit] [cron_expression]",
            examples: [
              "/schedule add name:DailyAQ frequency:daily time:08:00 message:AQ starts soon! target_channel_id:#alliance-chat - Schedules a daily reminder in #alliance-chat.",
              "/schedule add name:AWReminder frequency:weekly time:19:00 day:monday command:/aw plan battlegroup:1 - Schedules a weekly AW plan command on Mondays.",
              "/schedule add name:CustomPing frequency:custom time:00:00 cron_expression:0 0 1 * * message:Monthly ping! - Schedules a monthly ping using a cron expression.",
            ],
          },
        ],
        [
          "list",
          {
            description:
              "List all active scheduled tasks. Displays the name, frequency, time, and content of each scheduled task, along with an ID for removal.",
            usage: "/schedule list",
            examples: [
              "/schedule list - Shows all your active scheduled tasks.",
            ],
          },
        ],
        [
          "remove",
          {
            description:
              "Remove an existing scheduled task by its ID or list number. Use /schedule list to find the ID or number of the task you wish to remove.",
            usage: "/schedule remove <id|number>",
            examples: [
              "/schedule remove id:a1b2c3d4e5f6 - Removes the scheduled task with the specified ID.",
              "/schedule remove number:1 - Removes the first scheduled task from the list.",
            ],
          },
        ],
      ]),
    },
  ],
  [
    "search",
    {
      description:
        "Powerful search for champions based on various criteria, acting as a comprehensive in-game wiki. Filters are case-insensitive.",
      access: CommandAccess.PUBLIC,
      group: "Information & Search",
      subcommands: new Map([
        [
          "all",
          {
            description:
              "Search the entire champion database using a wide range of filters. This is your go-to command for finding champions based on abilities, immunities, tags, classes, ability categories, and attack types.",
            usage:
              "/search all [abilities] [immunities] [tags] [class] [ability-category] [attack-type]",
            filters: new Map([
              [
                "abilities",
                "Filter by champion abilities (e.g., `abilities:poison` to find champions with poison abilities).",
              ],
              [
                "immunities",
                "Filter by champion immunities (e.g., `immunities:bleed` to find bleed-immune champions).",
              ],
              [
                "tags",
                "Filter by champion tags (e.g., `tags:#2025` to find champions with the 2025 tag).",
              ],
              [
                "class",
                "Filter by champion class (e.g., `class:skill`).",
              ],
              [
                "ability-category",
                "Filter by ability category (e.g., `ability-category:buffs`).",
              ],
              [
                "attack-type",
                "Filter by attack type and properties. Syntax: `[all|any] [group] [props...]`. E.g., `all basic energy` or `s1 non-contact`.",
              ],
            ]),
            andOrLogic:
              "Filters can be combined using `AND` or `OR`. For example: `abilities:poison and shock` or `class:skill or mutant`. This logic applies to all filter types.",
            examples: [
              "/search all immunities:poison abilities:fury",
              "/search all immunities:bleed and incinerate",
              "/search all attack-type:all basic energy - Finds champions with all basic attacks having energy properties.",
            ],
            image: "https://storage.googleapis.com/champion-images/feature-showcase/search_crush.png",
          },
        ],
        [
          "roster",
          {
            description:
              "Search within a player's personal champion roster using the same powerful filters as `/search all`. This helps you quickly find specific champions you own based on their attributes.",
            usage:
              "/search roster [abilities] [immunities] [tags] [class] [ability-category] [attack-type] [player]",
            filters: new Map([
              ["abilities", "Filter by champion abilities."],
              ["immunities", "Filter by champion immunities."],
              ["tags", "Filter by champion tags."],
              ["class", "Filter by champion class."],
              ["ability-category", "Filter by ability category."],
              ["attack-type", "Filter by attack type and properties."],
              [
                "player",
                "The player whose roster to search (defaults to you).",
              ],
            ]),
            andOrLogic:
              "The `AND/OR` logic works identically to `/search all`. All filters listed above can be combined.",
            examples: [
              "/search roster class:tech",
              "/search roster immunities:incinerate and poison",
              "/search roster attack-type:m1 non-contact - Finds champions in your roster with non-contact M1 attacks.",
            ],
            image: "https://storage.googleapis.com/champion-images/feature-showcase/search_roster_complex.png",
          },
        ],
      ]),
    },
  ],
  [
    "summarize",
    {
      description:
        "Summarizes recent messages in a channel or thread using AI. You can specify a timeframe, target channel, language, and even a custom prompt for the summarization.",
      access: CommandAccess.PUBLIC,
      group: "Utilities",
      subcommands: new Map([
        [
          "default",
          {
            description:
              "Summarizes recent messages in a channel or thread using AI.",
            usage:
              "/summarize <timeframe> [channel] [language] [custom_prompt]",
            examples: [
              "/summarize timeframe:24h",
              "/summarize timeframe:today channel:#general language:Spanish",
              "/summarize timeframe:lastweek",
            ],
          },
        ],
      ]),
    },
  ],
]);