export interface MergedAssignment {
  playerName: string;
  node: string;
  attackerName: string;
  defenderName: string;
  prefightPlayer: string;
  prefightChampion: string;
  attackTactic: string;
  defenseTactic: string;
}

export interface WarData {
  season: number;
  warNumber: number;
  warTier: number;
  enemyAlliance?: string;
}
