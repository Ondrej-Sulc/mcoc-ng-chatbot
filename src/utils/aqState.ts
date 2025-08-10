import fs from "node:fs";
import path from "node:path";

export type SectionKey = "s1" | "s2" | "s3";

export interface PlayerSectionState {
  done: boolean;
}

export interface AQState {
  channelId: string;
  messageId: string;
  roleId: string;
  day: number;
  status: "active" | "ended" | "completed" | "ended_manual";
  mapStatus: string;
  players: Record<SectionKey, Record<string, PlayerSectionState>>;
  // timestamps are stored as ISO strings
  startTimeIso: string;
  endTimeIso: string;
  slackerPingSent?: boolean;
  finalPingSent?: boolean;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "aq_state.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readAllState(): Record<string, AQState> {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeAllState(state: Record<string, AQState>) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function getState(channelId: string): AQState | undefined {
  const all = readAllState();
  return all[channelId];
}

export function setState(channelId: string, state: AQState | undefined) {
  const all = readAllState();
  if (state) {
    all[channelId] = state;
  } else {
    delete all[channelId];
  }
  writeAllState(all);
}
