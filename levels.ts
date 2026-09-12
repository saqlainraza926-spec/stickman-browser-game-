import type { Gem, Laser, Level, Platform, Saw, Spike, Spring, Turret, Vec } from "./types";

/* ------------------------------------------------------------------ */
/* deterministic rng                                                    */
/* ------------------------------------------------------------------ */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ */
/* builder context                                                      */
/* ------------------------------------------------------------------ */
interface Ctx {
  r: () => number;
  d: number; // 0..1 difficulty
  plats: Platform[];
  spikes: Spike[];
  saws: Saw[];
  lasers: Laser[];
  springs: Spring[];
  turrets: Turret[];
  path: Vec[];
  x: number; // right edge of the last surface
  y: number; // top surface of the last surface
}

const PH = 20;

function plat(c: Ctx, x: number, y: number, w: number, h: number, kind: Platform["kind"] = "solid", move?: Platform["move"]) {
  c.plats.push({ x, y, w, h, kind, move });
}

function node(c: Ctx, x: number, y: number, w: number, kind: Platform["kind"] = "solid", move?: Platform["move"]) {
  plat(c, x, y, w, PH, kind, move);
  c.path.push({ x: x + w / 2, y: y - 26 });
  c.x = x + w;
  c.y = y;
}

function gapSaw(c: Ctx, x: number, y: number, extra = 0) {
  const r = lerp(15, 23, c.r());
  const span = lerp(110, 190, c.r()) + extra;
  c.saws.push({
    x,
    y,
    r,
    spin: (c.r() < 0.5 ? -1 : 1) * lerp(4, 9, c.r()),
    move: { ax: x, ay: y + 40, bx: x, by: y - span, speed: lerp(70, 150, c.r()) * (0.8 + c.d * 0.7), phase: c.r() },
  });
}

/* ------------------------------------------------------------------ */
/* segments                                                             */
/* ------------------------------------------------------------------ */

function segRun(c: Ctx, count: number) {
  const maxGap = lerp(96, 148, c.d);
  const minW = lerp(110, 46, c.d);
  for (let i = 0; i < count; i++) {
    const gap = lerp(62, maxGap, c.r());
    const w = minW * (0.85 + c.r() * 0.75);
    let dy = (c.r() * 2 - 1) * lerp(70, 118, c.d);
    if (c.y + dy < -1150) dy = Math.abs(dy);
    if (c.y + dy > 340) dy = -Math.abs(dy);
    // the wider the gap, the less height the player can gain in one jump
    const gapFrac = clamp((gap - 62) / 90, 0, 1);
    dy = clamp(dy, -(104 - gapFrac * 46), 150);
    const nx = c.x + gap;
    const ny = c.y + dy;
    node(c, nx, ny, w);
    if (c.d > 0.04 && c.r() < 0.18 + c.d * 0.5) gapSaw(c, nx - gap / 2, Math.min(ny, c.y) - 10);
  }
}

function segCrumble(c: Ctx, count: number) {
  for (let i = 0; i < count; i++) {
    const gap = lerp(66, 124, c.r() * (0.5 + c.d * 0.5));
    const w = lerp(74, 42, c.d) * (0.9 + c.r() * 0.4);
    let dy = (c.r() * 2 - 1) * 64;
    if (c.y + dy < -1150) dy = Math.abs(dy);
    dy = clamp(dy, -86, 110);
    node(c, c.x + gap, c.y + dy, w, "crumble");
  }
  // safe landing after the crumble chain
  segRun(c, 1);
}

function segMovers(c: Ctx, count: number) {
  for (let i = 0; i < count; i++) {
    const gap = lerp(70, 128, c.r());
    const w = lerp(88, 58, c.d);
    const ax = c.x + gap;
    const ay = clamp(c.y + (c.r() * 2 - 1) * 60, -1150, 340);
    const vertical = c.r() < 0.45;
    const dist = lerp(80, 170, c.r());
    const mv = vertical
      ? { ax, ay, bx: ax, by: ay - dist, speed: lerp(52, 105, c.r()), phase: c.r() }
      : { ax, ay, bx: ax - dist, by: ay - lerp(0, 46, c.r()), speed: lerp(56, 112, c.r()), phase: c.r() };
    node(c, ax, ay, w, "solid", mv);
    if (c.d > 0.45 && c.r() < 0.5) gapSaw(c, ax - gap / 2, ay - 20);
  }
  segRun(c, 1);
}

function segChimney(c: Ctx, height: number) {
  const gapW = lerp(126, 108, c.d);
  const x0 = c.x + lerp(48, 92, c.r());
  const bottom = c.y + 4;
  const top = bottom - height;
  // floor of the shaft
  plat(c, x0, bottom, gapW + 36, PH, "solid");
  // walls
  plat(c, x0, top - 120, 18, height + 124, "wall");
  plat(c, x0 + 18 + gapW, top, 18, height + 4, "wall");
  // exit ledge flush with the right wall top
  const ledgeW = lerp(78, 120, c.r());
  plat(c, x0 + 18 + gapW, top, 18 + ledgeW, PH, "solid");

  for (let h = bottom - 60; h > top; h -= 90) c.path.push({ x: x0 + 18 + gapW / 2, y: h });

  if (c.d > 0.34) {
    const n = 1 + Math.floor(c.d * 2.2);
    for (let i = 0; i < n; i++) {
      const sy = lerp(top + 50, bottom - 40, (i + 0.5) / n);
      c.saws.push({
        x: x0 + 27,
        y: sy,
        r: lerp(13, 18, c.r()),
        spin: 6,
        move: {
          ax: x0 + 30,
          ay: sy,
          bx: x0 + 24 + gapW,
          by: sy + (c.r() - 0.5) * 40,
          speed: lerp(58, 118, c.r()) * (0.7 + c.d),
          phase: c.r(),
        },
      });
    }
  }
  c.path.push({ x: x0 + 18 + gapW + ledgeW / 2, y: top - 26 });
  c.x = x0 + 18 + gapW + 18 + ledgeW;
  c.y = top;
}

function segSpring(c: Ctx) {
  const gap = lerp(58, 104, c.r());
  const w = 74;
  const px = c.x + gap;
  const py = clamp(c.y + lerp(-20, 60, c.r()), -1150, 340);
  node(c, px, py, w, "solid");
  c.springs.push({ x: px + w / 2 - 17, y: py - 14, power: 935 });
  // upper ledge reachable only with the spring
  const up = lerp(150, 186, c.r());
  const lw = lerp(82, 120, c.r());
  const lx = c.x + lerp(24, 78, c.r());
  node(c, lx, py - up, lw, "solid");
  if (c.d > 0.4) gapSaw(c, lx - 24, py - up - 40, 40);
}

function segChasm(c: Ctx) {
  const span = lerp(188, 234, c.d);
  const w = lerp(96, 62, c.d);
  const ny = clamp(c.y + lerp(-18, 58, c.r()), -1150, 340);
  const nx = c.x + span;
  node(c, nx, ny, w, "solid");
  const midX = nx - span / 2;
  if (c.r() < 0.55) {
    c.lasers.push({
      x: midX - 9,
      y: Math.min(ny, c.y) - 150,
      w: 18,
      h: 260,
      period: lerp(2.1, 3.1, c.r()),
      duty: lerp(0.34, 0.5, c.r()),
      phase: c.r(),
    });
  } else {
    gapSaw(c, midX, Math.min(ny, c.y) - 30, 60);
  }
}

function segLaserHall(c: Ctx) {
  const w = lerp(210, 310, c.r());
  const gap = lerp(64, 108, c.r());
  const nx = c.x + gap;
  const ny = clamp(c.y + (c.r() * 2 - 1) * 46, -1150, 340);
  node(c, nx, ny, w, "solid");
  const beams = 2 + Math.floor(c.d * 2.6);
  for (let i = 0; i < beams; i++) {
    const bx = nx + ((i + 1) / (beams + 1)) * w;
    c.lasers.push({
      x: bx - 8,
      y: ny - 128,
      w: 16,
      h: 128,
      period: lerp(1.8, 2.8, c.r()),
      duty: lerp(0.32, 0.48, c.r()),
      phase: c.r(),
    });
  }
}

function segTurretRun(c: Ctx) {
  const w = lerp(190, 280, c.r());
  const gap = lerp(60, 104, c.r());
  const nx = c.x + gap;
  const ny = clamp(c.y + (c.r() * 2 - 1) * 40, -1150, 340);
  node(c, nx, ny, w, "solid");
  plat(c, nx + w - 16, ny - 74, 16, 74, "wall");
  c.turrets.push({
    x: nx + w - 20,
    y: ny - 30,
    dir: -1,
    period: lerp(1.15, 1.9, c.r()) * (1 - c.d * 0.28),
    phase: c.r(),
    speed: lerp(210, 330, c.r()),
  });
  if (c.d > 0.6) {
    c.turrets.push({
      x: nx + 26,
      y: ny - 60,
      dir: 1,
      period: lerp(1.4, 2.2, c.r()),
      phase: c.r(),
      speed: lerp(190, 300, c.r()),
    });
    plat(c, nx + 20, ny - 52, 13, 52, "wall");
  }
}

function segStairs(c: Ctx, count: number, dir: number) {
  for (let i = 0; i < count; i++) {
    const gap = lerp(58, 104, c.r());
    const w = lerp(84, 50, c.d);
    const dy = dir * lerp(52, 92, c.r());
    const ny = clamp(c.y + dy, -1150, 340);
    node(c, c.x + gap, ny, w, "solid");
    if (c.d > 0.5 && c.r() < 0.45) gapSaw(c, c.x - w - gap / 2, ny - 18);
  }
}

function segPillars(c: Ctx, count: number) {
  for (let i = 0; i < count; i++) {
    const gap = lerp(74, 132, c.r());
    const w = lerp(52, 30, c.d);
    let dy = (c.r() * 2 - 1) * 86;
    if (c.y + dy < -1150) dy = Math.abs(dy);
    const ny = clamp(c.y + dy, -1150, 340);
    const nx = c.x + gap;
    node(c, nx, ny, w, "solid");
    plat(c, nx + w / 2 - 7, ny + PH, 14, 150, "solid");
    if (c.r() < 0.35 + c.d * 0.4) gapSaw(c, nx - gap / 2, ny - 26);
  }
}

/* ------------------------------------------------------------------ */
/* naming                                                               */
/* ------------------------------------------------------------------ */
const ADJ = [
  "Rusty", "Hollow", "Neon", "Frozen", "Shattered", "Crimson", "Silent", "Twisted", "Molten", "Forgotten",
  "Electric", "Savage", "Velvet", "Obsidian", "Howling", "Gilded", "Phantom", "Iron", "Static", "Endless",
];
const NOUN = [
  "Gantry", "Spires", "Conduit", "Chasm", "Furnace", "Skyline", "Circuit", "Ascent", "Gauntlet", "Vault",
  "Reactor", "Drop", "Lattice", "Relay", "Ridge", "Foundry", "Tangle", "Shaft", "Grid", "Verge",
];

const TIER_NAMES = ["Scrapyard", "Undercity", "Sawmill", "Power Grid", "Voidworks", "Final Circuit"];

/* ------------------------------------------------------------------ */
/* level assembly                                                       */
/* ------------------------------------------------------------------ */
function buildLevel(id: number): Level {
  const r = mulberry32(id * 7919 + 104729);
  const d = (id - 1) / 59;
  const tier = Math.min(5, Math.floor((id - 1) / 10));

  const c: Ctx = { r, d, plats: [], spikes: [], saws: [], lasers: [], springs: [], turrets: [], path: [], x: 0, y: 0 };

  // starting ledge
  plat(c, 40, 0, 150, PH, "solid");
  c.path.push({ x: 100, y: -26 });
  c.x = 190;
  c.y = 0;

  const pool: Array<() => void> = [() => segRun(c, 2 + Math.floor(r() * 2))];
  if (id >= 4) pool.push(() => segStairs(c, 2 + Math.floor(r() * 2), r() < 0.5 ? -1 : 1));
  if (id >= 6) pool.push(() => segCrumble(c, 2 + Math.floor(d * 3)));
  if (id >= 8) pool.push(() => segChimney(c, lerp(170, 330, r())));
  if (id >= 12) pool.push(() => segSpring(c));
  if (id >= 15) pool.push(() => segMovers(c, 1 + Math.floor(d * 2.4)));
  if (id >= 21) pool.push(() => segPillars(c, 2 + Math.floor(d * 2)));
  if (id >= 26) pool.push(() => segLaserHall(c));
  if (id >= 31) pool.push(() => segTurretRun(c));
  if (id >= 38) pool.push(() => segChasm(c));

  const segCount = Math.round(lerp(4, 9, d));
  segRun(c, 1);
  for (let i = 0; i < segCount; i++) {
    const f = pool[Math.floor(r() * pool.length)];
    f();
  }
  segRun(c, 1);

  // final platform + goal
  const finalW = 132;
  node(c, c.x + lerp(70, 120, r()), clamp(c.y + (r() * 2 - 1) * 60, -1150, 340), finalW, "solid");
  const goal = { x: c.x - finalW / 2 - 20, y: c.y - 56, w: 40, h: 56 };

  // ---- normalize coordinates ------------------------------------------------
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const touch = (x: number, y: number, w = 0, h = 0) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  };
  c.plats.forEach((p) => {
    touch(p.x, p.y, p.w, p.h);
    if (p.move) touch(p.move.bx, p.move.by, p.w, p.h);
  });
  c.saws.forEach((s) => {
    touch(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    if (s.move) touch(s.move.bx - s.r, s.move.by - s.r, s.r * 2, s.r * 2);
  });
  c.lasers.forEach((l) => touch(l.x, l.y, l.w, l.h));
  touch(goal.x, goal.y, goal.w, goal.h);

  const offX = 90 - minX;
  const offY = 170 - minY;
  const shift = (o: { x: number; y: number }) => {
    o.x += offX;
    o.y += offY;
  };
  c.plats.forEach((p) => {
    shift(p);
    if (p.move) {
      p.move.ax += offX;
      p.move.bx += offX;
      p.move.ay += offY;
      p.move.by += offY;
    }
  });
  c.saws.forEach((s) => {
    shift(s);
    if (s.move) {
      s.move.ax += offX;
      s.move.bx += offX;
      s.move.ay += offY;
      s.move.by += offY;
    }
  });
  c.lasers.forEach(shift);
  c.springs.forEach(shift);
  c.turrets.forEach(shift);
  c.path.forEach(shift);
  shift(goal);

  const width = maxX + offX + 170;
  const height = maxY + offY + 210;

  // ---- bottom spike field ---------------------------------------------------
  const floorY = height - 30;
  for (let x = 0; x < width; x += 30) c.spikes.push({ x, y: floorY, w: 30, h: 30, dir: "up" });

  // ---- ceiling spikes for the meanest tiers ---------------------------------
  if (d > 0.55) {
    const n = Math.floor(lerp(1, 5, d));
    for (let i = 0; i < n; i++) {
      const idx = 1 + Math.floor(r() * (c.path.length - 3));
      const p = c.path[idx];
      const nxt = c.path[idx + 1];
      // never hang spikes where the player needs a full-height jump to continue
      if (!p || !nxt || nxt.y < p.y - 34 || Math.abs(nxt.x - p.x) > 220) continue;
      c.spikes.push({ x: p.x - 40 + (r() - 0.5) * 40, y: p.y - 126, w: 80, h: 26, dir: "down" });
    }
  }

  // ---- spikes on wide platform tops -----------------------------------------
  if (d > 0.2) {
    c.plats.forEach((p, i) => {
      if (i === 0 || i >= c.plats.length - 2) return;
      if (p.kind !== "solid" || p.move || p.w < 150 || p.h > PH + 2) return;
      if (r() > 0.25 + d * 0.45) return;
      const sw = Math.min(52, p.w * 0.28);
      const sx = p.x + p.w * 0.52;
      c.spikes.push({ x: sx, y: p.y - 22, w: sw, h: 22, dir: "up" });
    });
  }

  // ---- keep the spawn + goal pockets free of hazards -------------------------
  const spawnX = 40 + offX + 46;
  const spawnY = offY - 36;
  const safeZones = [
    { x: spawnX - 80, y: spawnY - 110, w: 190, h: 170 },
    { x: goal.x - 44, y: goal.y - 40, w: goal.w + 88, h: goal.h + 74 },
  ];
  const nearZone = (x: number, y: number, pad: number) =>
    safeZones.some((z) => x > z.x - pad && x < z.x + z.w + pad && y > z.y - pad && y < z.y + z.h + pad);

  for (let i = c.saws.length - 1; i >= 0; i--) {
    const s = c.saws[i];
    const pts = s.move
      ? [
          { x: s.move.ax, y: s.move.ay },
          { x: s.move.bx, y: s.move.by },
          { x: (s.move.ax + s.move.bx) / 2, y: (s.move.ay + s.move.by) / 2 },
        ]
      : [{ x: s.x, y: s.y }];
    if (pts.some((p) => nearZone(p.x, p.y, s.r + 14))) c.saws.splice(i, 1);
  }
  for (let i = c.lasers.length - 1; i >= 0; i--) {
    const l = c.lasers[i];
    if (safeZones.some((z) => l.x < z.x + z.w && l.x + l.w > z.x && l.y < z.y + z.h && l.y + l.h > z.y)) c.lasers.splice(i, 1);
  }
  for (let i = c.turrets.length - 1; i >= 0; i--) {
    if (nearZone(c.turrets[i].x, c.turrets[i].y, 150)) c.turrets.splice(i, 1);
  }

  // ---- gems -----------------------------------------------------------------
  const gems: Gem[] = [];
  const picks = [0.26, 0.55, 0.84];
  picks.forEach((f, i) => {
    const idx = clamp(Math.floor(c.path.length * f), 1, c.path.length - 2);
    const p = c.path[idx] ?? c.path[0];
    if (!p) return;
    const risky = d > 0.35 && i === 1;
    gems.push({ x: p.x + (r() - 0.5) * 40, y: p.y - (risky ? 92 : 30) });
  });

  const dist = c.path.reduce((acc, p, i) => (i === 0 ? 0 : acc + Math.hypot(p.x - c.path[i - 1].x, p.y - c.path[i - 1].y)), 0);
  const parTime = Math.round((dist / 215 + 5 + d * 8) * 10) / 10;

  const name = `${ADJ[(id * 5 + 3) % ADJ.length]} ${NOUN[(id * 11 + 7) % NOUN.length]}`;

  const hints: Record<number, string> = {
    1: "Move with A / D  ·  Jump with SPACE",
    2: "Hold SPACE longer to jump higher",
    3: "SHIFT = air dash (8 directions, recharges on ground)",
    4: "Tap R to restart instantly · collect all 3 gems for a perfect clear",
    5: "Dash upward (SHIFT + W) for extra height",
    6: "Orange platforms crumble the instant you land. Keep moving!",
    8: "Press into a wall to cling, then SPACE to wall-jump",
    12: "Springs launch you far above a normal jump",
    15: "Blue platforms move — ride them, or wait for them",
    21: "Saws run on fixed loops. Watch, then commit.",
    26: "Lasers pulse on a timer — read the rhythm",
    31: "Turrets fire in bursts. Jump the shots.",
    38: "Big chasm ahead: run, jump, then dash mid-air",
    51: "Final circuit. Everything, all at once. Good luck.",
  };

  return {
    id,
    name,
    tier,
    width,
    height,
    spawn: { x: 40 + offX + 46, y: offY - 36 },
    goal,
    platforms: c.plats,
    spikes: c.spikes,
    saws: c.saws,
    lasers: c.lasers,
    springs: c.springs,
    turrets: c.turrets,
    gems,
    path: c.path,
    parTime,
    hint: hints[id],
  };
}

let cache: Level[] | null = null;

export function getLevels(): Level[] {
  if (!cache) {
    cache = [];
    for (let i = 1; i <= 60; i++) cache.push(buildLevel(i));
    // spawn sits on the first ledge of each level
    cache.forEach((lv) => {
      const first = lv.platforms[0];
      lv.spawn = { x: first.x + 46, y: first.y - 36 };
    });
  }
  return cache;
}

export function getLevel(id: number): Level {
  return getLevels()[clamp(id, 1, 60) - 1];
}

export function tierName(tier: number) {
  return TIER_NAMES[clamp(tier, 0, 5)];
}

export const TIER_COLORS = [
  { a: "#1b2735", b: "#0f1620", accent: "#5ee7ff" },
  { a: "#231a33", b: "#120e1c", accent: "#c084fc" },
  { a: "#33231a", b: "#1c1310", accent: "#fb923c" },
  { a: "#132a26", b: "#0b1917", accent: "#34d399" },
  { a: "#2a1326", b: "#190b16", accent: "#f472b6" },
  { a: "#2b0f14", b: "#17070a", accent: "#ff4d5e" },
];
