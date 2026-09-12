export interface LevelRecord {
  done: boolean;
  best: number; // best time in seconds
  gems: number; // bitmask
  deaths: number;
}

export interface Progress {
  levels: Record<number, LevelRecord>;
  unlocked: number;
}

const KEY = "stickman-60-progress-v1";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (p && typeof p.unlocked === "number" && p.levels) return p;
    }
  } catch {
    /* ignore */
  }
  return { levels: {}, unlocked: 1 };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function recordClear(p: Progress, id: number, time: number, deaths: number, gems: boolean[]): Progress {
  const mask = gems.reduce((m, g, i) => (g ? m | (1 << i) : m), 0);
  const prev = p.levels[id];
  const next: LevelRecord = {
    done: true,
    best: prev?.done ? Math.min(prev.best, time) : time,
    gems: (prev?.gems ?? 0) | mask,
    deaths: (prev?.deaths ?? 0) + deaths,
  };
  const out: Progress = {
    levels: { ...p.levels, [id]: next },
    unlocked: Math.max(p.unlocked, Math.min(60, id + 1)),
  };
  saveProgress(out);
  return out;
}

export function totalGems(p: Progress) {
  return Object.values(p.levels).reduce((n, r) => n + ((r.gems & 1) + ((r.gems >> 1) & 1) + ((r.gems >> 2) & 1)), 0);
}

export function totalCleared(p: Progress) {
  return Object.values(p.levels).filter((r) => r.done).length;
}

export function totalDeaths(p: Progress) {
  return Object.values(p.levels).reduce((n, r) => n + r.deaths, 0);
}

export function fmtTime(t: number) {
  if (!isFinite(t)) return "--:--";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}
