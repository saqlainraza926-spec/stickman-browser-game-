import type { Bullet, InputState, Level, Particle, Platform } from "./types";

export const TUNE = {
  gravity: 1980,
  jumpHoldMul: 0.54,
  maxFall: 940,
  runSpeed: 268,
  accelGround: 2500,
  accelAir: 1950,
  frictionGround: 2700,
  frictionAir: 420,
  jumpVel: 572,
  coyote: 0.1,
  jumpBuffer: 0.12,
  wallSlide: 138,
  wallJumpX: 352,
  wallJumpY: 536,
  wallLock: 0.14,
  dashSpeed: 545,
  dashTime: 0.16,
  dashEnd: 300,
  pw: 17,
  ph: 33,
};

export const VIEW_W = 960;
export const VIEW_H = 540;

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  wallDir: number;
  dashT: number;
  dashVX: number;
  dashVY: number;
  dashReady: boolean;
  lockT: number;
  facing: number;
  anim: number;
  squash: number;
  state: "idle" | "run" | "jump" | "fall" | "wall" | "dash";
}

export type Status = "playing" | "dead" | "won";

type Rect = { x: number; y: number; w: number; h: number };

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function pathPos(m: NonNullable<Platform["move"]>, time: number) {
  const len = Math.hypot(m.bx - m.ax, m.by - m.ay) || 1;
  const cycle = (2 * len) / m.speed;
  let t = ((time / cycle + m.phase) % 1) * 2;
  if (t < 0) t += 2;
  const u = t < 1 ? t : 2 - t;
  const e = u * u * (3 - 2 * u); // smooth ease
  return { x: m.ax + (m.bx - m.ax) * e, y: m.ay + (m.by - m.ay) * e };
}

export class Game {
  level: Level;
  p: Player;
  status: Status = "playing";
  time = 0;
  deaths = 0;
  runTime = 0;
  deadT = 0;
  winT = 0;
  shake = 0;
  camX = 0;
  camY = 0;
  particles: Particle[] = [];
  bullets: Bullet[] = [];
  gems: boolean[] = [];
  ghostTrail: { x: number; y: number; a: number; f: number }[] = [];
  standing: Platform | null = null;
  onEvent?: (e: "jump" | "dash" | "death" | "gem" | "win" | "land" | "spring" | "walljump") => void;

  constructor(level: Level) {
    this.level = level;
    this.p = this.makePlayer();
    this.gems = level.gems.map(() => false);
    this.resetLevel(true);
  }

  private makePlayer(): Player {
    return {
      x: this.level.spawn.x,
      y: this.level.spawn.y,
      vx: 0,
      vy: 0,
      grounded: false,
      coyote: 0,
      buffer: 0,
      wallDir: 0,
      dashT: 0,
      dashVX: 0,
      dashVY: 0,
      dashReady: true,
      lockT: 0,
      facing: 1,
      anim: 0,
      squash: 0,
      state: "fall",
    };
  }

  resetLevel(full: boolean) {
    this.p = this.makePlayer();
    this.status = "playing";
    this.deadT = 0;
    this.winT = 0;
    this.particles.length = 0;
    this.bullets.length = 0;
    this.ghostTrail.length = 0;
    this.gems = this.level.gems.map(() => false);
    this.standing = null;
    this.level.platforms.forEach((pl) => {
      pl.crumbleT = 0;
      pl.dead = false;
      pl.respawnT = 0;
    });
    this.level.springs.forEach((s) => (s.anim = 0));
    this.level.turrets.forEach((t) => (t.t = t.phase * t.period));
    if (full) {
      this.time = 0;
      this.deaths = 0;
      this.runTime = 0;
    }
    this.camX = Math.max(0, Math.min(this.level.width - VIEW_W, this.p.x - VIEW_W / 2));
    this.camY = Math.max(0, Math.min(this.level.height - VIEW_H, this.p.y - VIEW_H / 2));
  }

  private solids(): Rect[] {
    const out: Rect[] = [];
    for (const pl of this.level.platforms) {
      if (pl.dead) continue;
      out.push({ x: pl.cx ?? pl.x, y: pl.cy ?? pl.y, w: pl.w, h: pl.h });
    }
    return out;
  }

  private platRect(pl: Platform): Rect {
    return { x: pl.cx ?? pl.x, y: pl.cy ?? pl.y, w: pl.w, h: pl.h };
  }

  burst(x: number, y: number, n: number, color: string, spread = 210, grav = 900) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * spread;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life: 0.4 + Math.random() * 0.6,
        maxLife: 1,
        size: 1.5 + Math.random() * 2.5,
        color,
        grav,
      });
    }
  }

  kill() {
    if (this.status !== "playing") return;
    this.status = "dead";
    this.deadT = 0;
    this.deaths++;
    this.shake = 12;
    this.burst(this.p.x + TUNE.pw / 2, this.p.y + TUNE.ph / 2, 34, "#ff4d5e", 300);
    this.burst(this.p.x + TUNE.pw / 2, this.p.y + TUNE.ph / 2, 14, "#ffffff", 190);
    this.onEvent?.("death");
  }

  update(dt: number, input: InputState) {
    dt = Math.min(dt, 0.05);
    const steps = Math.ceil(dt / 0.008);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.substep(h, input, i === 0);
    input.jumpPressed = false;
    input.dashPressed = false;
  }

  private substep(dt: number, input: InputState, first: boolean) {
    this.time += dt;
    const lv = this.level;
    const p = this.p;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 42);

    // ---- world elements --------------------------------------------------
    for (const pl of lv.platforms) {
      pl.px = pl.cx ?? pl.x;
      pl.py = pl.cy ?? pl.y;
      if (pl.move) {
        const q = pathPos(pl.move, this.time);
        pl.cx = q.x;
        pl.cy = q.y;
      } else {
        pl.cx = pl.x;
        pl.cy = pl.y;
      }
      if (pl.dead) {
        pl.respawnT = (pl.respawnT ?? 0) - dt;
        if ((pl.respawnT ?? 0) <= 0) {
          pl.dead = false;
          pl.crumbleT = 0;
        }
      }
    }
    for (const s of lv.saws) {
      s.angle = (s.angle ?? 0) + s.spin * dt;
      if (s.move) {
        const q = pathPos(s.move, this.time);
        s.cx = q.x;
        s.cy = q.y;
      } else {
        s.cx = s.x;
        s.cy = s.y;
      }
    }
    for (const l of lv.lasers) {
      const t = (this.time / l.period + l.phase) % 1;
      l.on = t < l.duty;
    }
    for (const t of lv.turrets) {
      t.t = (t.t ?? 0) + dt;
      if (t.t >= t.period) {
        t.t -= t.period;
        this.bullets.push({ x: t.x + t.dir * 14, y: t.y, vx: t.dir * t.speed, life: 1.55 });
      }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.life -= dt;
      let gone = b.life <= 0 || b.x < -50 || b.x > lv.width + 50;
      if (!gone) {
        for (const pl of lv.platforms) {
          if (pl.dead) continue;
          const qx = pl.cx ?? pl.x;
          const qy = pl.cy ?? pl.y;
          if (b.x + 6 > qx && b.x - 6 < qx + pl.w && b.y + 3 > qy && b.y - 3 < qy + pl.h) {
            gone = true;
            this.burst(b.x, b.y, 4, "#fda4af", 70, 200);
            break;
          }
        }
      }
      if (gone) this.bullets.splice(i, 1);
    }
    for (const s of lv.springs) s.anim = Math.max(0, (s.anim ?? 0) - dt * 3.4);

    // ---- particles -------------------------------------------------------
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
      this.ghostTrail[i].a -= dt * 3.2;
      if (this.ghostTrail[i].a <= 0) this.ghostTrail.splice(i, 1);
    }

    if (this.status === "dead") {
      this.deadT += dt;
      this.updateCamera(dt);
      if (this.deadT > 0.42) this.softRespawn();
      return;
    }
    if (this.status === "won") {
      this.winT += dt;
      this.updateCamera(dt);
      return;
    }

    this.runTime += dt;

    // ---- carry on moving platform ---------------------------------------
    if (this.standing && !this.standing.dead && this.standing.move) {
      p.x += (this.standing.cx ?? 0) - (this.standing.px ?? 0);
      p.y += (this.standing.cy ?? 0) - (this.standing.py ?? 0);
      // never let a carried rider end up buried inside a wall
      for (const s of this.solids()) {
        const box = { x: p.x, y: p.y, w: TUNE.pw, h: TUNE.ph };
        if (!overlap(box, s)) continue;
        const outLeft = s.x - (p.x + TUNE.pw);
        const outRight = s.x + s.w - p.x;
        p.x += Math.abs(outLeft) < Math.abs(outRight) ? outLeft : outRight;
      }
    }

    // ---- input -----------------------------------------------------------
    let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (p.lockT > 0) {
      p.lockT -= dt;
      dir = 0;
    }
    if (dir !== 0 && p.dashT <= 0) p.facing = dir;

    if (input.jumpPressed && first) p.buffer = TUNE.jumpBuffer;
    p.buffer -= dt;
    p.coyote -= dt;

    // ---- dash ------------------------------------------------------------
    if (input.dashPressed && first && p.dashReady && p.dashT <= 0) {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx === 0 && dy === 0) dx = p.facing;
      const m = Math.hypot(dx, dy) || 1;
      p.dashVX = (dx / m) * TUNE.dashSpeed;
      p.dashVY = (dy / m) * TUNE.dashSpeed;
      p.dashT = TUNE.dashTime;
      p.dashReady = false;
      p.lockT = 0;
      this.shake = Math.max(this.shake, 4);
      this.onEvent?.("dash");
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashVX;
      p.vy = p.dashVY;
      if (Math.random() < 0.75) this.ghostTrail.push({ x: p.x, y: p.y, a: 1, f: p.facing });
      if (p.dashT <= 0) {
        p.vx = Math.sign(p.dashVX) * Math.min(Math.abs(p.dashVX), TUNE.dashEnd);
        p.vy = p.dashVY < 0 ? Math.max(p.dashVY * 0.55, -TUNE.dashEnd) : p.dashVY * 0.3;
      }
    } else {
      // horizontal movement
      const accel = p.grounded ? TUNE.accelGround : TUNE.accelAir;
      if (dir !== 0) {
        p.vx += dir * accel * dt;
        p.vx = Math.max(-TUNE.runSpeed, Math.min(TUNE.runSpeed, p.vx));
      } else {
        const f = (p.grounded ? TUNE.frictionGround : TUNE.frictionAir) * dt;
        if (Math.abs(p.vx) <= f) p.vx = 0;
        else p.vx -= Math.sign(p.vx) * f;
      }
      // gravity
      const holding = input.jump && p.vy < 0;
      let g = TUNE.gravity * (holding ? TUNE.jumpHoldMul : 1);
      if (p.wallDir !== 0 && p.vy > 0 && !p.grounded) {
        g *= 0.5;
        p.vy = Math.min(p.vy, TUNE.wallSlide);
        if (Math.random() < 0.25)
          this.particles.push({
            x: p.x + (p.wallDir > 0 ? TUNE.pw : 0),
            y: p.y + Math.random() * TUNE.ph,
            vx: -p.wallDir * 30,
            vy: -20,
            life: 0.3,
            maxLife: 0.3,
            size: 1.6,
            color: "#94a3b8",
            grav: 120,
          });
      }
      p.vy = Math.min(p.vy + g * dt, TUNE.maxFall);
    }

    // ---- jump ------------------------------------------------------------
    if (p.buffer > 0) {
      if (p.grounded || p.coyote > 0) {
        p.vy = -TUNE.jumpVel;
        p.grounded = false;
        p.coyote = 0;
        p.buffer = 0;
        p.dashT = 0;
        p.squash = -0.35;
        this.burst(p.x + TUNE.pw / 2, p.y + TUNE.ph, 6, "#cbd5e1", 90, 500);
        this.onEvent?.("jump");
      } else if (p.wallDir !== 0) {
        p.vy = -TUNE.wallJumpY;
        p.vx = -p.wallDir * TUNE.wallJumpX;
        p.facing = -p.wallDir;
        p.lockT = TUNE.wallLock;
        p.buffer = 0;
        p.dashT = 0;
        p.dashReady = true;
        p.squash = -0.3;
        this.burst(p.x + (p.wallDir > 0 ? TUNE.pw : 0), p.y + TUNE.ph / 2, 8, "#cbd5e1", 120, 400);
        this.onEvent?.("walljump");
      }
    }

    // ---- integrate + collide --------------------------------------------
    const solids = this.solids();
    const wasGrounded = p.grounded;
    p.grounded = false;

    p.x += p.vx * dt;
    let box = { x: p.x, y: p.y, w: TUNE.pw, h: TUNE.ph };
    for (const s of solids) {
      if (!overlap(box, s)) continue;
      if (p.vx > 0) p.x = s.x - TUNE.pw;
      else if (p.vx < 0) p.x = s.x + s.w;
      else continue;
      p.vx = 0;
      if (p.dashT > 0 && Math.abs(p.dashVX) > 0) {
        p.dashT = 0;
        p.vy = Math.min(p.vy, 0);
      }
      box = { x: p.x, y: p.y, w: TUNE.pw, h: TUNE.ph };
    }

    p.y += p.vy * dt;
    box = { x: p.x, y: p.y, w: TUNE.pw, h: TUNE.ph };
    this.standing = null;
    for (const pl of lv.platforms) {
      if (pl.dead) continue;
      const s = this.platRect(pl);
      if (!overlap(box, s)) continue;
      if (p.vy > 0) {
        p.y = s.y - TUNE.ph;
        p.grounded = true;
        this.standing = pl;
        if (!wasGrounded && p.vy > 300) {
          p.squash = Math.min(0.5, p.vy / 1400);
          this.burst(p.x + TUNE.pw / 2, p.y + TUNE.ph, 5, "#cbd5e1", 80, 500);
          this.onEvent?.("land");
        }
        p.vy = 0;
      } else if (p.vy < 0) {
        p.y = s.y + s.h;
        p.vy = 0;
      }
      if (p.dashT > 0 && Math.abs(p.dashVY) > 0) p.dashT = 0;
      box = { x: p.x, y: p.y, w: TUNE.pw, h: TUNE.ph };
    }

    // ---- wall detection --------------------------------------------------
    p.wallDir = 0;
    if (!p.grounded) {
      for (const s of solids) {
        if (s.h < 26) continue;
        if (overlap({ x: p.x + TUNE.pw, y: p.y + 4, w: 3, h: TUNE.ph - 8 }, s) && dir >= 0 && input.right) p.wallDir = 1;
        if (overlap({ x: p.x - 3, y: p.y + 4, w: 3, h: TUNE.ph - 8 }, s) && dir <= 0 && input.left) p.wallDir = -1;
      }
    }

    if (p.grounded) {
      p.coyote = TUNE.coyote;
      p.dashReady = true;
    }
    if (p.wallDir !== 0) p.dashReady = true;

    // ---- crumble ---------------------------------------------------------
    if (this.standing && this.standing.kind === "crumble") {
      const pl = this.standing;
      pl.crumbleT = (pl.crumbleT ?? 0) + dt;
      if (pl.crumbleT > 0.42) {
        pl.dead = true;
        pl.respawnT = 2.2;
        this.burst((pl.cx ?? pl.x) + pl.w / 2, (pl.cy ?? pl.y) + pl.h / 2, 12, "#f59e0b", 130);
        this.standing = null;
      }
    }

    // ---- springs ---------------------------------------------------------
    for (const sp of lv.springs) {
      if (overlap({ x: p.x, y: p.y, w: TUNE.pw, h: TUNE.ph }, { x: sp.x, y: sp.y, w: 34, h: 16 }) && p.vy >= -10) {
        p.vy = -sp.power;
        p.dashReady = true;
        p.grounded = false;
        sp.anim = 1;
        p.squash = -0.45;
        this.burst(sp.x + 17, sp.y, 10, "#facc15", 160);
        this.onEvent?.("spring");
      }
    }

    // ---- animation state -------------------------------------------------
    p.squash += (0 - p.squash) * Math.min(1, dt * 9);
    p.anim += dt * (p.grounded ? Math.abs(p.vx) / 42 + 1.4 : 5);
    p.state = p.dashT > 0 ? "dash" : p.wallDir !== 0 ? "wall" : p.grounded ? (Math.abs(p.vx) > 22 ? "run" : "idle") : p.vy < 0 ? "jump" : "fall";

    // ---- hazards ---------------------------------------------------------
    const hb = { x: p.x + 3, y: p.y + 3, w: TUNE.pw - 6, h: TUNE.ph - 6 };
    if (p.y > lv.height + 40) return this.kill();

    for (const sp of lv.spikes) {
      const inset = sp.dir === "up" ? { x: sp.x + 3, y: sp.y + sp.h * 0.35, w: sp.w - 6, h: sp.h * 0.65 } : { x: sp.x + 3, y: sp.y, w: sp.w - 6, h: sp.h * 0.65 };
      if (overlap(hb, inset)) return this.kill();
    }
    for (const s of lv.saws) {
      const cx = s.cx ?? s.x;
      const cy = s.cy ?? s.y;
      const nx = Math.max(hb.x, Math.min(cx, hb.x + hb.w));
      const ny = Math.max(hb.y, Math.min(cy, hb.y + hb.h));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < (s.r - 2) ** 2) return this.kill();
    }
    for (const l of lv.lasers) {
      if (l.on && overlap(hb, { x: l.x + 2, y: l.y, w: l.w - 4, h: l.h })) return this.kill();
    }
    for (const b of this.bullets) {
      if (overlap(hb, { x: b.x - 6, y: b.y - 4, w: 12, h: 8 })) return this.kill();
    }

    // ---- gems ------------------------------------------------------------
    lv.gems.forEach((g, i) => {
      if (this.gems[i]) return;
      if (Math.hypot(g.x - (p.x + TUNE.pw / 2), g.y - (p.y + TUNE.ph / 2)) < 24) {
        this.gems[i] = true;
        this.burst(g.x, g.y, 16, "#67e8f9", 180, 240);
        this.onEvent?.("gem");
      }
    });

    // ---- goal ------------------------------------------------------------
    if (overlap(hb, lv.goal)) {
      this.status = "won";
      this.winT = 0;
      this.shake = 6;
      this.burst(lv.goal.x + lv.goal.w / 2, lv.goal.y + lv.goal.h / 2, 40, "#4ade80", 260, 200);
      this.onEvent?.("win");
    }

    this.updateCamera(dt);
  }

  private softRespawn() {
    const keepDeaths = this.deaths;
    const keepTime = this.runTime;
    this.resetLevel(false);
    this.deaths = keepDeaths;
    this.runTime = keepTime;
    this.burst(this.p.x + TUNE.pw / 2, this.p.y + TUNE.ph / 2, 12, "#38bdf8", 160, 200);
  }

  private updateCamera(dt: number) {
    const lv = this.level;
    const tx = this.p.x + TUNE.pw / 2 + this.p.vx * 0.18 - VIEW_W / 2;
    const ty = this.p.y + TUNE.ph / 2 + this.p.vy * 0.05 - VIEW_H / 2;
    const k = Math.min(1, dt * 6.5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camX = Math.max(0, Math.min(Math.max(0, lv.width - VIEW_W), this.camX));
    this.camY = Math.max(0, Math.min(Math.max(0, lv.height - VIEW_H), this.camY));
  }
}
