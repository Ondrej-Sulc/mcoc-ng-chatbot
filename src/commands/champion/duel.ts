import { ChampionWithAllRelations } from "../../services/championService";

export function getDuelContent(
  champion: ChampionWithAllRelations
): string {
  let content = "";
  if (!champion.duels || champion.duels.length === 0) {
    content = "No duel targets found for this champion.";
  } else {
    content = champion.duels
      .map((duel) => {
        let duelString = `### \`${duel.playerName}\``;
        if (duel.rank) {
          duelString += ` (${duel.rank})`;
        }
        return duelString;
      })
      .join("\n");
  }

  content += "\n\n*Data provided by GuiaMTC.com*";
  return content;
}
