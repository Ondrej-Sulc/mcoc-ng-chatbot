export interface SubcommandInfo {
  description: string;
  usage?: string;
  examples?: string[];
}

export interface CommandInfo {
  name: string;
  description: string;
  group?: string;
  subcommands: SubcommandInfo[];
}

export const commandData: CommandInfo[] = [
  {
    name: "admin",
    description: "Administrative commands for managing champions, abilities, attacks, and the glossary.",
    group: "BOT_ADMIN",
    subcommands: [
      { description: "Admin commands for managing champions.", usage: "/admin champion <subcommand>" },
      { description: "Admin commands for managing champion abilities and immunities.", usage: "/admin ability <subcommand>" },
      { description: "Admin commands for managing champion attack data.", usage: "/admin attack add <champion>" },
      { description: "Admin commands for managing glossary entries.", usage: "/admin glossary <subcommand>" },
      { description: "Admin commands for managing duel data.", usage: "/admin duel upload" },
    ],
  },
  {
    name: "alliance",
    description: "Manage your alliance, its features, and AQ schedule.",
    group: "Alliance Tools",
    subcommands: [
      {
        description: "Join an alliance and optionally register your in-game name.",
        usage: "/alliance join <role> [name]",
        examples: [
          "/alliance join role:@BG1 MyIGN - Joins the alliance with the BG1 role and sets your name to MyIGN.",
          "/alliance join role:@Member - Joins the alliance with the Member role if you're already registered.",
        ],
      },
      {
        description: "Enable or disable a feature for your alliance (Alliance Admin only).",
        usage: "/alliance toggle-feature <feature> <enabled>",
        examples: ["/alliance toggle-feature feature:AW_PLANNING enabled:true - Enables the Alliance War planning feature."],
      },
      {
        description: "Update your alliance's name (Alliance Admin only).",
        usage: "/alliance name <name>",
        examples: ["/alliance name name:My Awesome Alliance"],
      },
    ],
  },
  {
    name: "aq",
    description: "Alliance Quest (AQ) utilities.",
    group: "Alliance Tools",
    subcommands: [
      {
        description: "Start a new AQ tracker.",
        usage: "/aq start <day> <role> [channel] [create_thread]",
        examples: [
          "/aq start day:1 role:BattleGroup1 - Starts an AQ tracker for Day 1, assigning BattleGroup1 role members.",
          "/aq start day:2 role:BattleGroup2 channel:#aq-discussion create_thread:true - Starts an AQ tracker for Day 2 in #aq-discussion, creating a thread for updates.",
        ],
      },
      {
        description: "End the active AQ tracker in a channel.",
        usage: "/aq end [channel]",
        examples: [
          "/aq end - Ends the active AQ tracker in the current channel.",
          "/aq end channel:#aq-discussion - Ends the active AQ tracker in #aq-discussion.",
        ],
      },
      {
        description: "Manage the automated AQ schedule for your alliance through an interactive menu (Alliance Admin only).",
        usage: "/aq schedule",
      },
    ],
  },
  {
    name: "aw",
    description: "Commands for Alliance War planning and details.",
    group: "Alliance Tools",
    subcommands: [
      {
        description: "Sends Alliance War plan details from a Google Sheet to player threads.",
        usage: "/aw plan <battlegroup> [player] [image]",
      },
      {
        description: "Get detailed information about your Alliance War assignments.",
        usage: "/aw details [node]",
        examples: [
          "/aw details - Shows all your AW assignments in the current war thread.",
          "/aw details node:5 - Shows details for your assignment on Node 5.",
        ],
      },
    ],
  },
  {
    name: "champion",
    description: "Get detailed information about any champion in the game.",
    group: "Information & Search",
    subcommands: [
      { description: "Display a champion's core details and full abilities.", usage: "/champion info <champion>" },
      { description: "Display a champion's attack types and properties.", usage: "/champion attacks <champion>" },
      { description: "List all of a champion's abilities.", usage: "/champion abilities <champion>" },
      { description: "List all of a champion's immunities.", usage: "/champion immunities <champion>" },
      { description: "List all of a champion's tags.", usage: "/champion tags <champion>" },
      { description: "Display a comprehensive overview of a champion.", usage: "/champion overview <champion>" },
      { description: "Get duel targets for a champion.", usage: "/champion duel <champion>" },
    ],
  },
  {
    name: "glossary",
    description: "Look up MCOC effects, buffs, and debuffs.",
    group: "Information & Search",
    subcommands: [
      { description: "Look up a specific effect by name.", usage: "/glossary effect <effect>" },
      { description: "List all effects within a specific category.", usage: "/glossary category <category>" },
      { description: "List all available effect categories.", usage: "/glossary list" },
    ],
  },
  {
    name: "prestige",
    description: "Extract prestige values from an MCOC screenshot or view the leaderboard.",
    group: "User Management",
    subcommands: [
      { description: "Update your prestige values by uploading a screenshot.", usage: "/prestige update <image> [player]" },
      { description: "View the server prestige leaderboard.", usage: "/prestige leaderboard" },
    ],
  },
  {
    name: "profile",
    description: "Manage your in-game profiles.",
    group: "User Management",
    subcommands: [
      { description: "Displays an interactive dashboard of your active profile.", usage: "/profile view [user]" },
      { description: "Adds a new in-game profile.", usage: "/profile add <name>" },
      { description: "Switches your active in-game profile.", usage: "/profile switch <name>" },
      { description: "Lists all of your registered in-game profiles.", usage: "/profile list" },
      { description: "Removes one of your registered in-game profiles.", usage: "/profile remove <name>" },
      { description: "Renames one of your registered in-game profiles.", usage: "/profile rename <current_name> <new_name>" },
      { description: "Sets the local timezone for your active profile.", usage: "/profile timezone <timezone>" },
    ],
  },
  {
    name: "register",
    description: "For new users to register their in-game name with the bot.",
    group: "User Management",
    subcommands: [
      {
        description: "Registers your in-game name.",
        usage: "/register <name>",
        examples: ['/register name:MyIGN - Registers your in-game name as "MyIGN".'],
      },
    ],
  },
  {
    name: "roster",
    description: "Manage your MCOC roster.",
    group: "User Management",
    subcommands: [
      {
        description: "Update your roster by uploading one or more screenshots.",
        usage: "/roster update <stars> <rank> <image1> [is_ascended] [image2] [image3] [image4] [image5] [player]",
      },
      {
        description: "View a player's roster.",
        usage: "/roster view [stars] [rank] [is_ascended] [player]",
        examples: [
          "/roster view - Shows your entire roster.",
          "/roster view stars:6 rank:5 - Shows your 6-star, Rank 5 champions.",
          "/roster view is_ascended:true player:@Ally - Shows @Ally's ascended champions.",
        ],
      },
      {
        description: "Delete champions from a player's roster.",
        usage: "/roster delete [champion] [stars] [rank] [is_ascended] [player]",
      },
      {
        description: "Display a summary of a player's roster.",
        usage: "/roster summary [player]",
        examples: ["/roster summary - Shows a summary of your roster.", "/roster summary player:@Ally - Shows a summary of @Ally's roster."],
      },
      {
        description: "Export a player's roster to a CSV file.",
        usage: "/roster export [player]",
        examples: ["/roster export - Exports your roster to a CSV file.", "/roster export player:@Ally - Exports @Ally's roster to a CSV file."],
      },
    ],
  },
  {
    name: "schedule",
    description: "Manage scheduled tasks.",
    group: "Utilities",
    subcommands: [
      {
        description: "Add a new scheduled task.",
        usage: "/schedule add <name> <frequency> <time> [command] [message] [target_channel_id] [target_user_id] [day] [interval] [unit]",
        examples: [
          "/schedule add name:DailyAQ frequency:daily time:08:00 message:AQ starts soon! target_channel_id:#alliance-chat - Schedules a daily reminder in #alliance-chat.",
          "/schedule add name:AWReminder frequency:weekly time:19:00 day:monday command:/aw plan battlegroup:1 - Schedules a weekly AW plan command on Mondays.",
        ],
      },
      { description: "List all active scheduled tasks.", usage: "/schedule list" },
      {
        description: "Remove an existing scheduled task by its ID or list number.",
        usage: "/schedule remove <id|number>",
        examples: [
          "/schedule remove id:a1b2c3d4e5f6 - Removes the scheduled task with the specified ID.",
          "/schedule remove number:1 - Removes the first scheduled task from the list.",
        ],
      },
    ],
  },
  {
    name: "search",
    description: "Powerful search for champions based on various criteria.",
    group: "Information & Search",
    subcommands: [
      {
        description: "Search the entire champion database using a wide range of filters.",
        usage: "/search all [abilities] [immunities] [tags] [class] [ability-category] [attack-type]",
        examples: [
          "/search all immunities:poison abilities:fury",
          "/search all immunities:bleed and incinerate",
          "/search all attack-type:all basic energy - Finds champions with all basic attacks having energy properties.",
        ],
      },
      {
        description: "Search within a player's personal champion roster.",
        usage: "/search roster [abilities] [immunities] [tags] [class] [ability-category] [attack-type] [player]",
        examples: [
          "/search roster class:tech",
          "/search roster immunities:incinerate and poison",
          "/search roster attack-type:m1 non-contact - Finds champions in your roster with non-contact M1 attacks.",
        ],
      },
    ],
  },
  {
    name: "summarize",
    description: "Summarizes recent messages in a channel or thread using AI.",
    group: "Utilities",
    subcommands: [
      {
        description: "Summarizes recent messages in a channel or thread using AI.",
        usage: "/summarize <timeframe> [channel] [language] [custom_prompt]",
        examples: [
          "/summarize timeframe:24h",
          "/summarize timeframe:today channel:#general language:Spanish",
          "/summarize timeframe:lastweek",
        ],
      },
    ],
  },
];
