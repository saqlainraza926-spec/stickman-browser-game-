import { useCallback, useEffect, useRef, useState } from "react";
import { Game, VIEW_H, VIEW_W } from "../game/engine";
import { getLevel, tierName } from "../game/levels";
import { render } from "../game/render";
import { fmtTime } from "../game/progress";
import { sfx, unlockAudio } from "../game/audio";
import type { InputState } from "../game/types";

interface Props {
  levelId: number;
  best?: number;
  onExit: () => void;
  onComplete: (time: number, deaths: number, gems: boolean[]) => void;
  onNext: () => void;
}

const emptyInput = (): InputState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
  dash: false,
  dashPressed: false,
});

export default function GameView({ levelId, best, onExit, onComplete, onNext }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<InputState>(emptyInput());
  const pausedRef = useRef(false);
  const completedRef = useRef(false);

  const [hud, setHud] = useState({ time: 0, deaths: 0, gems: [false, false, false], dash: true, prog: 0 });
  const [paused, setPaused] = useState(false);
  const [won, setWon] = useState<null | { time: number; deaths: number; gems: boolean[] }>(null);
  const [hintVisible, setHintVisible] = useState(true);

  const level = getLevel(levelId);

  const restart = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.resetLevel(true);
    completedRef.current = false;
    setWon(null);
    setPaused(false);
    pausedRef.current = false;
  }, []);

  /* ---------------- game loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.scale(dpr, dpr);

    const g = new Game(getLevel(levelId));
    gameRef.current = g;
    completedRef.current = false;
    setWon(null);
    setHintVisible(true);

    g.onEvent = (e) => {
      if (e === "jump") sfx.jump();
      else if (e === "walljump") sfx.walljump();
      else if (e === "dash") sfx.dash();
      else if (e === "death") sfx.death();
      else if (e === "gem") sfx.gem();
      else if (e === "spring") sfx.spring();
      else if (e === "land") sfx.land();
      else if (e === "win") sfx.win();
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) g.update(dt, inputRef.current);
      render(ctx, g);

      acc += dt;
      if (acc > 0.08) {
        acc = 0;
        const span = g.level.goal.x - g.level.spawn.x || 1;
        setHud({
          time: g.runTime,
          deaths: g.deaths,
          gems: [...g.gems],
          dash: g.p.dashReady,
          prog: Math.max(0, Math.min(1, (g.p.x - g.level.spawn.x) / span)),
        });
      }
      if (g.status === "won" && !completedRef.current && g.winT > 0.55) {
        completedRef.current = true;
        const res = { time: g.runTime, deaths: g.deaths, gems: [...g.gems] };
        setWon(res);
        onComplete(res.time, res.deaths, res.gems);
      }
    };
    raf = requestAnimationFrame(loop);

    const hintTimer = window.setTimeout(() => setHintVisible(false), 5200);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hintTimer);
    };
  }, [levelId, onComplete]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const codes = new Set([
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS",
      "ShiftLeft", "ShiftRight", "KeyJ", "KeyK", "KeyR", "Escape",
    ]);
    const down = (e: KeyboardEvent) => {
      if (codes.has(e.code)) e.preventDefault();
      unlockAudio();
      const i = inputRef.current;
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          i.left = true;
          break;
        case "ArrowRight":
        case "KeyD":
          i.right = true;
          break;
        case "ArrowUp":
        case "KeyW":
          i.up = true;
          break;
        case "ArrowDown":
        case "KeyS":
          i.down = true;
          break;
        case "Space":
        case "KeyK":
          if (!e.repeat) i.jumpPressed = true;
          i.jump = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
        case "KeyJ":
          if (!e.repeat) i.dashPressed = true;
          i.dash = true;
          break;
        case "KeyR":
          if (!e.repeat) restart();
          break;
        case "Escape":
          if (!e.repeat) {
            pausedRef.current = !pausedRef.current;
            setPaused(pausedRef.current);
          }
          break;
        default:
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      const i = inputRef.current;
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          i.left = false;
          break;
        case "ArrowRight":
        case "KeyD":
          i.right = false;
          break;
        case "ArrowUp":
        case "KeyW":
          i.up = false;
          break;
        case "ArrowDown":
        case "KeyS":
          i.down = false;
          break;
        case "Space":
        case "KeyK":
          i.jump = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
        case "KeyJ":
          i.dash = false;
          break;
        default:
          break;
      }
    };
    const blur = () => {
      inputRef.current = emptyInput();
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [restart]);

  /* ---------------- touch button helper ---------------- */
  const touchProps = (apply: (i: InputState, v: boolean) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      unlockAudio();
      apply(inputRef.current, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      apply(inputRef.current, false);
    },
    onPointerLeave: () => apply(inputRef.current, false),
    onPointerCancel: () => apply(inputRef.current, false),
  });

  const gemsCollected = hud.gems.filter(Boolean).length;

  return (
    <div className="relative mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-3 py-3 sm:px-5">
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.ui();
              onExit();
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold tracking-wide text-slate-200 transition hover:bg-white/15"
          >
            ← Levels
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {tierName(level.tier)} · Level {level.id}/60
            </div>
            <div className="text-lg font-black leading-tight text-white">{level.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Stat label="Time" value={fmtTime(hud.time)} />
          <Stat label="Deaths" value={String(hud.deaths)} tone={hud.deaths > 0 ? "red" : "normal"} />
          <Stat label="Best" value={best ? fmtTime(best) : "—"} />
          <div className="flex items-center gap-1">
            {hud.gems.map((got, i) => (
              <span
                key={i}
                className={`inline-block h-3.5 w-3.5 rotate-45 rounded-[3px] border transition ${
                  got ? "border-cyan-200 bg-cyan-300 shadow-[0_0_10px_#22d3ee]" : "border-white/25 bg-white/5"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              pausedRef.current = !pausedRef.current;
              setPaused(pausedRef.current);
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-white/15"
          >
            {paused ? "▶" : "❚❚"}
          </button>
        </div>
      </div>

      {/* canvas */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_60px_-15px_rgba(56,189,248,0.45)]">
        <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "16 / 9", touchAction: "none" }} />

        {/* dash pip */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-300 backdrop-blur">
          <span className={`h-2.5 w-2.5 rounded-full ${hud.dash ? "bg-sky-300 shadow-[0_0_10px_#38bdf8]" : "bg-slate-600"}`} />
          Dash
        </div>

        {/* route progress */}
        <div className="pointer-events-none absolute right-3 top-4 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-[width] duration-150"
            style={{ width: `${hud.prog * 100}%` }}
          />
        </div>

        {level.hint && hintVisible && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-center text-xs font-semibold tracking-wide text-slate-200 backdrop-blur sm:text-sm">
            {level.hint}
          </div>
        )}

        {paused && !won && (
          <Overlay>
            <h2 className="text-3xl font-black text-white">Paused</h2>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Btn
                onClick={() => {
                  pausedRef.current = false;
                  setPaused(false);
                }}
              >
                Resume
              </Btn>
              <Btn onClick={restart} variant="ghost">
                Restart (R)
              </Btn>
              <Btn onClick={onExit} variant="ghost">
                Level Select
              </Btn>
            </div>
          </Overlay>
        )}

        {won && (
          <Overlay>
            <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-300">Level Clear</div>
            <h2 className="mt-1 text-4xl font-black text-white drop-shadow">{level.name}</h2>
            <div className="mt-4 flex items-center gap-6 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Time</div>
                <div className="text-xl font-black text-white">{fmtTime(won.time)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Deaths</div>
                <div className="text-xl font-black text-white">{won.deaths}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">Gems</div>
                <div className="text-xl font-black text-cyan-300">{gemsCollected}/3</div>
              </div>
            </div>
            {won.time <= level.parTime && (
              <div className="mt-3 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-200">
                ★ Under par ({level.parTime.toFixed(1)}s)
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {level.id < 60 && <Btn onClick={onNext}>Next Level →</Btn>}
              <Btn onClick={restart} variant="ghost">
                Retry
              </Btn>
              <Btn onClick={onExit} variant="ghost">
                Level Select
              </Btn>
            </div>
          </Overlay>
        )}
      </div>

      {/* controls legend */}
      <div className="hidden flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 sm:flex">
        <span>A / D · Move</span>
        <span>Space · Jump</span>
        <span>Wall + Space · Wall Jump</span>
        <span>Shift · Dash</span>
        <span>R · Restart</span>
        <span>Esc · Pause</span>
      </div>

      {/* touch controls */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <div className="flex gap-3">
          <TouchBtn {...touchProps((i, v) => (i.left = v))}>◀</TouchBtn>
          <TouchBtn {...touchProps((i, v) => (i.right = v))}>▶</TouchBtn>
        </div>
        <div className="flex justify-end gap-3">
          <TouchBtn
            {...touchProps((i, v) => {
              i.dash = v;
              if (v) i.dashPressed = true;
            })}
            accent="sky"
          >
            ⚡
          </TouchBtn>
          <TouchBtn
            {...touchProps((i, v) => {
              i.jump = v;
              if (v) i.jumpPressed = true;
            })}
            accent="emerald"
          >
            ⤒
          </TouchBtn>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "red" }) {
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`font-mono text-sm font-bold ${tone === "red" ? "text-rose-300" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "solid" }: { children: React.ReactNode; onClick: () => void; variant?: "solid" | "ghost" }) {
  return (
    <button
      onClick={() => {
        sfx.ui();
        onClick();
      }}
      className={
        variant === "solid"
          ? "rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-sky-500/25 transition hover:brightness-110"
          : "rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/15"
      }
    >
      {children}
    </button>
  );
}

function TouchBtn({
  children,
  accent = "slate",
  ...rest
}: { children: React.ReactNode; accent?: "slate" | "sky" | "emerald" } & React.HTMLAttributes<HTMLButtonElement>) {
  const tone =
    accent === "sky"
      ? "border-sky-300/40 bg-sky-400/20 text-sky-100"
      : accent === "emerald"
        ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
        : "border-white/15 bg-white/10 text-slate-100";
  return (
    <button
      {...rest}
      className={`h-16 w-16 select-none rounded-2xl border text-2xl font-black active:scale-95 ${tone}`}
      style={{ touchAction: "none" }}
    >
      {children}
    </button>
  );
}
