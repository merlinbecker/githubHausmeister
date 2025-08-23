import fs from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), "data/state.json");

export interface AppStateFile {
  monthlyDone: number;
  lastReset: string;
  systemRunning: boolean;
}

const DEFAULT_STATE: AppStateFile = {
  monthlyDone: 0,
  lastReset: new Date().toISOString(),
  systemRunning: true,
};

export function loadStateFromFile(): AppStateFile {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      saveStateToFile(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const data = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading state file:", error);
    return DEFAULT_STATE;
  }
}

export function saveStateToFile(state: AppStateFile) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("Error saving state file:", error);
  }
}

export function resetMonthlyCounterIfNeeded() {
  const state = loadStateFromFile();
  const lastReset = new Date(state.lastReset);
  const now = new Date();
  
  // Reset if it's a new month
  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    const newState = {
      ...state,
      monthlyDone: 0,
      lastReset: now.toISOString(),
    };
    saveStateToFile(newState);
    return newState;
  }
  
  return state;
}
