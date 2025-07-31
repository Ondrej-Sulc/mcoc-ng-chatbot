# MCOC Next-Gen Chatbot (TypeScript)

A personal, modular Discord bot built with TypeScript, designed for Marvel Contest of Champions (MCOC) related tasks. This bot integrates with Google Sheets for data logging and OpenRouter for AI capabilities, all running on Discord.js v14.

## Key Features

- **Dynamic Command Loading:** Commands in the `src/commands` directory are automatically registered on startup.
- **PostgreSQL Database:** Uses a robust PostgreSQL database managed with Prisma for persistent data storage.
- **Google Sheets Integration:** Utilizes Google Sheets for data storage and retrieval (e.g., for scheduling).
- **Advanced Scheduling:** Schedule commands or custom messages with flexible timing (daily, weekly, custom cron, etc.) via `/schedule`.
- **Centralized Error Handling:** A robust system that provides users with a unique error ID while logging detailed context for debugging.
- **Dockerized Environment:** Fully containerized with Docker Compose for consistent development and easy deployment, including a PostgreSQL database service.
- **AI Capabilities:** Integration with OpenRouter for advanced AI features.

## Technology Stack

- **Language:** TypeScript (Strict Mode)
- **Framework:** Discord.js v14
- **Database:** PostgreSQL with Prisma ORM
- **APIs:** Google Sheets, OpenRouter
- **Scheduling:** `node-cron`
- **Containerization:** Docker & Docker Compose

---

## Migration

This section outlines the plan and progress for migrating commands from the legacy Python bot to this new TypeScript version.

**Migration Goals & Rules:**

*   **Slash Commands Only:** All commands will be implemented as slash commands (`/`).
*   **Effective Subcommands:** Use subcommands and subcommand groups to create a clear and intuitive command structure.
*   **Modern Components:** Utilize modern Discord UI components (Buttons, Select Menus, Modals) where applicable to improve user experience.
*   **Robust Error Handling:** Implement comprehensive error handling for all commands.
*   **Database:** Transition from JSON files to a more robust database solution.
*   **Code Quality:** Ensure all new code is well-documented, follows the existing project structure, and is written in an idiomatic TypeScript style.

**Legacy Command Status:**

*This list will be populated to track the migration status of each command.*

*   **`account.py`**:
    *   `/link_account`: To be reviewed
    *   `/delete_account_link`: To be reviewed
    *   `/register_thread`: To be reviewed
    *   `/unregister_thread`: To be reviewed
*   **`admin.py`**:
    *   `/update_bot`: Not to be migrated (not necessary anymore)
    *   `/sync_commands`: Not to be migrated (not necessary anymore)
    *   `/update`: Not to be migrated (not necessary anymore)
*   **`aq.py`**:
    *   `/aq` (group command): To be reviewed
        *   `/aq start`: To be reviewed
        *   `/aq end`: To be reviewed
        *   `/aq test_ping`: To be reviewed
*   **`champion_info.py`**:
    *   `/full_abilities`: To be reviewed
    *   `/glossary`: To be reviewed
    *   `/glossary_category`: To be reviewed
    *   `/attacks`: To be reviewed
    *   `/search`: To be reviewed
    *   `/my_roster_search`: To be reviewed
    *   `/roster_search`: To be reviewed
    *   `/duel`: To be reviewed
    *   `/immunities`: To be reviewed
    *   `/abilities`: To be reviewed
*   **`general.py`**:
    *   `/summarize`: Migrated
    *   `/hello`: Not to be migrated (redundant)
*   **`prestige.py`**:
    *   `/prestige_list`: To be reviewed
    *   `/prestige`: To be reviewed
*   **`remind.py`**:
    *   `/remind`: Not to be migrated (replaced by new scheduler)
    *   `/remind_mute`: Not to be migrated (replaced by new scheduler)
    *   `/remind_list`: Not to be migrated (replaced by new scheduler)
    *   `/remind_delete`: Not to be migrated (replaced by new scheduler)
*   **`roster.py`**:
    *   `$roster` (text command, needs migration to slash): To be reviewed
    *   `/roster_clear_cache`: To be reviewed
    *   `/roster_add`: To be reviewed
    *   `/roster_delete`: To be reviewed
    *   `/roster_convert`: To be reviewed
*   **`war.py`**:
    *   `/aw_plan`: Migrated (as `/aw plan`)
    *   `/aw_details`: Migrated (as `/aw details`)

---

## Getting Started (Local Development)

### Prerequisites

- Node.js v18+
- Docker and Docker Compose
- A Discord Bot application
- API keys for Google and OpenRouter

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd mcoc-ng-chatbot
```

### 2. Set Up Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in the values in the `.env` file. This includes your Discord bot token, API keys, and the connection details for your PostgreSQL database.

**Important:** For `GOOGLE_CREDENTIALS_JSON`, you must provide the full JSON content of your service account key, encoded in Base64. You can generate this with the following command:

```bash
# For Linux/macOS
cat /path/to/your/credentials.json | base64 -w 0

# For Windows (in PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("/path/to/your/credentials.json"))
```

Copy the resulting string into the `.env` file.

### 3. Run the Initial Database Migration

Before starting the bot for the first time, you need to create the tables in your database.

```bash
npx prisma migrate dev --name init
```

### 4. Run the Bot

Use Docker Compose to build the images and start the containers (bot and database). The `docker-compose.yaml` is configured for development with hot-reloading.

```bash
docker-compose up --build
```

The bot should now be running and connected to Discord and the database.

---

## Project Structure

mcoc-ng-chatbot/
├── prisma/ # Prisma schema and migration files
│   └── schema.prisma
├── src/
│   ├── commands/ # Each file is a slash command
│   ├── types/ # Shared TypeScript interfaces and types
│   ├── utils/ # Service clients and helper functions
│   ├── config.ts # Environment variable loading and validation
│   └── index.ts # Bot entry point, client setup, event handlers
├── Dockerfile # Multi-stage build for lean production images
├── docker-compose.yaml # Development environment setup
└── README.md # You are here