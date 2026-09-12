export type Vec = { x: number; y: number };

export type PlatformKind = "solid" | "crumble" | "ice" | "wall";

export interface MovePath {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  speed: number; // units per second
  phase: number; // 0..1
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlatformKind;
  move?: MovePath;
  // runtime
  cx?: number;
  cy?: number;
  px?: number;
  py?: number;
  crumbleT?: number;
  dead?: boolean;
  respawnT?: number;
}

export type SpikeDir = "up" | "down" | "left" | "right";

export interface Spike {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: SpikeDir;
}

export interface Saw {
  x: number;
  y: number;
  r: number;
  move?: MovePath;
  spin: number;
  cx?: number;
  cy?: number;
  angle?: number;
}

export interface Laser {
  x: number;
  y: number;
  w: number;
  h: number;
  period: number; // seconds for full cycle
  duty: number; // fraction of cycle the laser is ON
  phase: number; // 0..1
  on?: boolean;
}

export interface Spring {
  x: number;
  y: number;
  power: number;
  anim?: number;
}

export interface Gem {
  x: number;
  y: number;
  taken?: boolean;
}

export interface Turret {
  x: number;
  y: number;
  dir: -1 | 1;
  period: number;
  phase: number;
  speed: number;
  t?: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  life: number;
}

export interface Level {
  id: number;
  name: string;
  tier: number;
  width: number;
  height: number;
  spawn: Vec;
  goal: { x: number; y: number; w: number; h: number };
  platforms: Platform[];
  spikes: Spike[];
  saws: Saw[];
  lasers: Laser[];
  springs: Spring[];
  turrets: Turret[];
  gems: Gem[];
  path: Vec[];
  parTime: number;
  hint?: string;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  dash: boolean;
  dashPressed: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
}
