import { getChampionByName } from "../../services/championService";
import { getApplicationEmojiMarkupByName } from "../../services/applicationEmojiService";
import { MergedAssignment } from "./types";

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const getEmoji = (championName: string): string => {
  if (!championName) return "";
  const champion = getChampionByName(championName);
  if (!champion || !champion.discordEmoji) return "";
  if (
    champion.discordEmoji.startsWith("<") &&
    champion.discordEmoji.endsWith(">")
  ) {
    return champion.discordEmoji;
  }
  return getApplicationEmojiMarkupByName(champion.discordEmoji) || "";
};

export const formatAssignment = (assignment: MergedAssignment): string => {
  const { attackerName, defenderName, attackTactic, defenseTactic } =
    assignment;
  const attackerEmoji = getEmoji(attackerName);
  const defenderEmoji = getEmoji(defenderName);

  let assignmentString = `${attackerEmoji} **${attackerName}** vs ${defenderEmoji} **${defenderName}**`;
  if (attackTactic) assignmentString += ` | ${attackTactic}`;
  if (defenseTactic) assignmentString += ` | ${defenseTactic}`;

  return assignmentString;
};
