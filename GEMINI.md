## Important Note on Discord.js Ephemeral Replies

**NEVER** use `ephemeral: true` in Discord.js interaction replies or deferrals. This option is deprecated and can lead to `InteractionAlreadyReplied` errors and other unexpected behavior. Always use `flags: MessageFlags.Ephemeral` instead to ensure correct and consistent ephemeral messaging.