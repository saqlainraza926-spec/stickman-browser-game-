import { Game, TUNE, VIEW_H, VIEW_W } from "./engine";
import { TIER_COLORS } from "./levels";


function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

const starCache = new Map<number, { x: number; y: number; r: number; a: number }[]>();
function stars(id: number) {
  let s = starCache.get(id);
  if (!s) {
    s = [];
    let seed = id * 9301 + 49297;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 90; i++) s.push({ x: rnd() * VIEW_W * 1.6, y: rnd() * VIEW_H * 1.4, r: rnd() * 1.6 + 0.4, a: rnd() * 0.6 + 0.2 });
    starCache.set(id, s);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* the stickman                                                        */
/* ------------------------------------------------------------------ */
export function drawStickman(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  state: string,
  anim: number,
  facing: number,
  squash: number,
  color: string,
  alpha = 1,
) {
  const cx = px + TUNE.pw / 2;
  const feet = py + TUNE.ph;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, feet);
  const sy = 1 - squash;
  const sx = 1 + squash * 0.55;
  ctx.scale(sx, sy);
  ctx.lineWidth = 3.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  const hipY = -13;
  const neckY = -25;
  const headY = -31;
  const t = anim;

  let lean = 0;
  if (state === "run") lean = facing * 2.4;
  if (state === "dash") lean = facing * 5;

  // torso
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(lean, neckY);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(lean + facing * 0.6, headY, 5.4, 0, Math.PI * 2);
  ctx.stroke();

  const limb = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  };

  const sh = neckY + 2.5;
  if (state === "run") {
    const s1 = Math.sin(t * 2.1);
    const s2 = Math.sin(t * 2.1 + Math.PI);
    limb(0, hipY, s1 * 6, hipY + 7, s1 * 11, Math.min(0, -Math.abs(s1) * 3));
    limb(0, hipY, s2 * 6, hipY + 7, s2 * 11, Math.min(0, -Math.abs(s2) * 3));
    limb(lean, sh, s2 * 6 + lean, sh + 6, s2 * 10 + lean, sh + 11);
    limb(lean, sh, s1 * 6 + lean, sh + 6, s1 * 10 + lean, sh + 11);
  } else if (state === "jump") {
    limb(0, hipY, facing * 5, hipY + 6, facing * 3, -1);
    limb(0, hipY, -facing * 3, hipY + 7, -facing * 8, -3);
    limb(lean, sh, lean + facing * 7, sh - 3, lean + facing * 11, sh - 9);
    limb(lean, sh, lean - facing * 6, sh + 2, lean - facing * 9, sh - 4);
  } else if (state === "fall") {
    limb(0, hipY, facing * 7, hipY + 6, facing * 10, 0);
    limb(0, hipY, -facing * 6, hipY + 7, -facing * 9, -1);
    limb(lean, sh, lean + facing * 8, sh - 6, lean + facing * 9, sh - 13);
    limb(lean, sh, lean - facing * 8, sh - 5, lean - facing * 10, sh - 12);
  } else if (state === "wall") {
    limb(0, hipY, facing * 4, hipY + 8, facing * 9, -1);
    limb(0, hipY, -facing * 2, hipY + 8, -facing * 2, 0);
    limb(lean, sh, lean + facing * 8, sh - 2, lean + facing * 11, sh - 8);
    limb(lean, sh, lean + facing * 5, sh + 5, lean + facing * 10, sh + 8);
  } else if (state === "dash") {
    limb(0, hipY, -facing * 6, hipY + 4, -facing * 13, hipY + 6);
    limb(0, hipY, -facing * 4, hipY + 8, -facing * 11, hipY + 11);
    limb(lean, sh, lean + facing * 9, sh + 1, lean + facing * 16, sh + 2);
    limb(lean, sh, lean + facing * 7, sh + 4, lean + facing * 13, sh + 6);
  } else {
    const b = Math.sin(t * 0.9) * 0.8;
    limb(0, hipY, 3.5, hipY + 7, 4.5, 0);
    limb(0, hipY, -3.5, hipY + 7, -4.5, 0);
    limb(lean, sh, 5 + b, sh + 6, 6 + b, sh + 12);
    limb(lean, sh, -5 - b, sh + 6, -6 - b, sh + 12);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* main renderer                                                       */
/* ------------------------------------------------------------------ */
export function render(ctx: CanvasRenderingContext2D, g: Game) {
  const lv = g.level;
  const col = TIER_COLORS[Math.min(5, lv.tier)];
  const sh = g.shake;
  const ox = -g.camX + (Math.random() - 0.5) * sh;
  const oy = -g.camY + (Math.random() - 0.5) * sh;

  // background -----------------------------------------------------------
  const bg = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  bg.addColorStop(0, col.a);
  bg.addColorStop(1, col.b);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  for (const s of stars(lv.id)) {
    const x = ((s.x - g.camX * 0.22) % (VIEW_W * 1.6) + VIEW_W * 1.6) % (VIEW_W * 1.6) - VIEW_W * 0.3;
    const y = ((s.y - g.camY * 0.22) % (VIEW_H * 1.4) + VIEW_H * 1.4) % (VIEW_H * 1.4) - VIEW_H * 0.2;
    ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(g.time * 2 + s.x));
    ctx.fillStyle = col.accent;
    ctx.fillRect(x, y, s.r, s.r);
  }
  ctx.restore();

  // parallax silhouettes
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = col.accent;
  for (let i = 0; i < 8; i++) {
    const bx = ((i * 340 - g.camX * 0.4) % (VIEW_W + 700) + VIEW_W + 700) % (VIEW_W + 700) - 350;
    const bh = 120 + ((i * 97) % 190);
    ctx.fillRect(bx, VIEW_H - bh + g.camY * 0.06, 150 + ((i * 53) % 90), bh + 200);
  }
  ctx.restore();

  // grid
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = col.accent;
  ctx.lineWidth = 1;
  const gs = 60;
  ctx.beginPath();
  for (let x = -((g.camX * 0.6) % gs); x < VIEW_W; x += gs) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW_H);
  }
  for (let y = -((g.camY * 0.6) % gs); y < VIEW_H; y += gs) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW_W, y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(ox, oy);

  const vis = (x: number, y: number, w: number, h: number) =>
    x + w > g.camX - 60 && x < g.camX + VIEW_W + 60 && y + h > g.camY - 60 && y < g.camY + VIEW_H + 60;

  // lasers (behind) -------------------------------------------------------
  for (const l of lv.lasers) {
    if (!vis(l.x, l.y, l.w, l.h)) continue;
    ctx.save();
    if (l.on) {
      ctx.shadowColor = "#ff2d55";
      ctx.shadowBlur = 22;
      const grd = ctx.createLinearGradient(l.x, 0, l.x + l.w, 0);
      grd.addColorStop(0, "rgba(255,45,85,0.15)");
      grd.addColorStop(0.5, "rgba(255,120,150,0.95)");
      grd.addColorStop(1, "rgba(255,45,85,0.15)");
      ctx.fillStyle = grd;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(l.x + l.w / 2 - 1.5, l.y, 3, l.h);
    } else {
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "#ff6b81";
      ctx.setLineDash([6, 9]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l.x + l.w / 2, l.y);
      ctx.lineTo(l.x + l.w / 2, l.y + l.h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.fillStyle = "#4b5563";
    rr(ctx, l.x - 5, l.y - 9, l.w + 10, 10, 3);
    ctx.fill();
    rr(ctx, l.x - 5, l.y + l.h - 1, l.w + 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = l.on ? "#ff4d5e" : "#6b7280";
    ctx.fillRect(l.x - 2, l.y - 4, l.w + 4, 3);
  }

  // platforms -------------------------------------------------------------
  for (const pl of lv.platforms) {
    const x = pl.cx ?? pl.x;
    const y = pl.cy ?? pl.y;
    if (!vis(x, y, pl.w, pl.h)) continue;
    ctx.save();
    if (pl.dead) {
      ctx.globalAlpha = 0.14;
    }
    let top = col.accent;
    let body = "rgba(15,23,42,0.92)";
    let jx = 0;
    if (pl.kind === "crumble") {
      top = "#fbbf24";
      body = "rgba(69,39,10,0.92)";
      if ((pl.crumbleT ?? 0) > 0) jx = (Math.random() - 0.5) * 3.4;
    } else if (pl.move) {
      top = "#60a5fa";
      body = "rgba(12,28,56,0.92)";
    } else if (pl.kind === "wall") {
      body = "rgba(15,23,42,0.95)";
    }
    ctx.translate(jx, 0);
    ctx.fillStyle = body;
    rr(ctx, x, y, pl.w, pl.h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowColor = top;
    ctx.shadowBlur = 12;
    ctx.fillStyle = top;
    if (pl.kind === "wall") {
      ctx.fillRect(x, y, 3, pl.h);
      ctx.fillRect(x + pl.w - 3, y, 3, pl.h);
    } else {
      ctx.fillRect(x + 1, y, pl.w - 2, 3);
    }
    ctx.shadowBlur = 0;
    if (pl.move) {
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = "#93c5fd";
      const c = x + pl.w / 2;
      ctx.beginPath();
      ctx.arc(c, y + pl.h / 2 + 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c - 9, y + pl.h / 2 + 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c + 9, y + pl.h / 2 + 1, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // springs ---------------------------------------------------------------
  for (const s of lv.springs) {
    if (!vis(s.x, s.y, 34, 20)) continue;
    const comp = (s.anim ?? 0) * 9;
    ctx.fillStyle = "#1f2937";
    rr(ctx, s.x, s.y + 12, 34, 8, 3);
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const yy = s.y + 14 - (i / 8) * (12 - comp);
      ctx.lineTo(s.x + (i % 2 === 0 ? 7 : 27), yy);
    }
    ctx.stroke();
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#fde047";
    rr(ctx, s.x, s.y + comp, 34, 6, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // turrets ---------------------------------------------------------------
  for (const t of lv.turrets) {
    if (!vis(t.x - 20, t.y - 20, 40, 40)) continue;
    ctx.fillStyle = "#334155";
    rr(ctx, t.x - 11, t.y - 11, 22, 22, 5);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(t.dir > 0 ? t.x + 6 : t.x - 20, t.y - 3.5, 14, 7);
    const charge = Math.min(1, ((t.t ?? 0) / t.period) ** 3);
    ctx.fillStyle = `rgba(255,80,80,${0.35 + charge * 0.65})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4 + charge * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // bullets ---------------------------------------------------------------
  ctx.save();
  ctx.shadowColor = "#fb7185";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#fda4af";
  for (const b of g.bullets) {
    rr(ctx, b.x - 7, b.y - 3, 14, 6, 3);
    ctx.fill();
  }
  ctx.restore();

  // spikes ----------------------------------------------------------------
  ctx.save();
  for (const sp of lv.spikes) {
    if (!vis(sp.x, sp.y, sp.w, sp.h)) continue;
    const n = Math.max(1, Math.round(sp.w / 13));
    const bw = sp.w / n;
    ctx.fillStyle = "#64748b";
    ctx.strokeStyle = "rgba(226,232,240,0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const x0 = sp.x + i * bw;
      ctx.beginPath();
      if (sp.dir === "down") {
        ctx.moveTo(x0, sp.y);
        ctx.lineTo(x0 + bw, sp.y);
        ctx.lineTo(x0 + bw / 2, sp.y + sp.h);
      } else {
        ctx.moveTo(x0, sp.y + sp.h);
        ctx.lineTo(x0 + bw, sp.y + sp.h);
        ctx.lineTo(x0 + bw / 2, sp.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();

  // saws ------------------------------------------------------------------
  for (const s of lv.saws) {
    const x = s.cx ?? s.x;
    const y = s.cy ?? s.y;
    if (!vis(x - s.r, y - s.r, s.r * 2, s.r * 2)) continue;
    if (s.move) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = "#f87171";
      ctx.setLineDash([4, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.move.ax, s.move.ay);
      ctx.lineTo(s.move.bx, s.move.by);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.angle ?? 0);
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rad = i % 2 === 0 ? s.r : s.r * 0.72;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.r * 0.55, 0);
    ctx.lineTo(s.r * 0.55, 0);
    ctx.stroke();
    ctx.restore();
  }

  // gems ------------------------------------------------------------------
  lv.gems.forEach((gem, i) => {
    if (g.gems[i]) return;
    if (!vis(gem.x - 12, gem.y - 12, 24, 24)) return;
    const bob = Math.sin(g.time * 3 + i) * 3;
    ctx.save();
    ctx.translate(gem.x, gem.y + bob);
    ctx.rotate(g.time * 1.5);
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(3.4, 0);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // goal ------------------------------------------------------------------
  const go = lv.goal;
  ctx.save();
  ctx.translate(go.x + go.w / 2, go.y + go.h);
  const pulse = 0.85 + Math.sin(g.time * 4) * 0.15;
  ctx.shadowColor = "#4ade80";
  ctx.shadowBlur = 26 * pulse;
  const grd = ctx.createLinearGradient(0, -go.h, 0, 0);
  grd.addColorStop(0, "rgba(74,222,128,0.06)");
  grd.addColorStop(1, "rgba(74,222,128,0.55)");
  ctx.fillStyle = grd;
  rr(ctx, -go.w / 2, -go.h, go.w, go.h, 10);
  ctx.fill();
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const t = (g.time * 0.8 + i / 3) % 1;
    ctx.globalAlpha = 1 - t;
    ctx.beginPath();
    ctx.ellipse(0, -go.h / 2, (go.w / 2) * (0.3 + t), (go.h / 2) * (0.3 + t), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // dash ghosts -----------------------------------------------------------
  for (const gh of g.ghostTrail) {
    drawStickman(ctx, gh.x, gh.y, "dash", 0, gh.f, 0, "#38bdf8", gh.a * 0.35);
  }

  // player ----------------------------------------------------------------
  if (g.status !== "dead") {
    const p = g.p;
    const body = p.dashT > 0 ? "#7dd3fc" : p.dashReady ? "#ffffff" : "#fca5a5";
    drawStickman(ctx, p.x, p.y, p.state, p.anim, p.facing, p.squash, body, g.status === "won" ? Math.max(0, 1 - g.winT * 1.2) : 1);
  }

  // particles -------------------------------------------------------------
  for (const q of g.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life * 1.6));
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // off-screen goal compass ------------------------------------------------
  const gxp = lv.goal.x + lv.goal.w / 2 - g.camX;
  const gyp = lv.goal.y + lv.goal.h / 2 - g.camY;
  if (gxp < 24 || gxp > VIEW_W - 24 || gyp < 24 || gyp > VIEW_H - 24) {
    const px = Math.max(34, Math.min(VIEW_W - 34, gxp));
    const py = Math.max(34, Math.min(VIEW_H - 34, gyp));
    const ang = Math.atan2(gyp - py || (gyp < py ? -1 : 1), gxp - px || (gxp < px ? -1 : 1));
    ctx.save();
    ctx.translate(px, py);
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(g.time * 5);
    ctx.rotate(ang);
    ctx.fillStyle = "#4ade80";
    ctx.shadowColor = "#4ade80";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // vignette --------------------------------------------------------------
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (g.status === "dead") {
    ctx.fillStyle = `rgba(255,60,80,${Math.max(0, 0.3 - g.deadT)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}


