import { Duel } from "@prisma/client";

export function getDuelContent(duels: Duel[]): string {
  let content = "";
  if (!duels || duels.length === 0) {
    content = "No active duel targets found for this champion.";
  } else {
    content = duels
      .map((duel) => {
        let duelString = `### \`${duel.playerName}\``;
        if (duel.rank) {
          duelString += ` (${duel.rank})`;
        }
        return duelString;
      })
      .join("\n");
  }

  content += "\n\n*Have a suggestion or see an outdated target? Use the buttons below!*";
  return content;
}
