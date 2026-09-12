import { useMemo, useState } from "react";
import { getLevels, tierName, TIER_COLORS } from "../game/levels";
import { fmtTime, totalCleared, totalDeaths, totalGems, type Progress } from "../game/progress";
import { sfx } from "../game/audio";

interface Props {
  progress: Progress;
  onPlay: (id: number) => void;
  onReset: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export default function LevelSelect({ progress, onPlay, onReset, muted, onToggleMute }: Props) {
  const levels = getLevels();
  const [tier, setTier] = useState(() => Math.min(5, Math.floor((progress.unlocked - 1) / 10)));
  const cleared = totalCleared(progress);
  const gems = totalGems(progress);
  const deaths = totalDeaths(progress);
  const nextLevel = Math.min(60, progress.unlocked);

  const shown = useMemo(() => levels.filter((l) => l.tier === tier), [levels, tier]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6 shadow-[0_0_80px_-30px_rgba(56,189,248,0.6)] sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-sky-300">A precision stickman platformer</div>
            <h1 className="mt-2 text-5xl font-black leading-none tracking-tighter text-white sm:text-6xl">
              STICK<span className="text-sky-400">RUNNER</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-400">
              60 brutally hard levels of saws, lasers, crumbling ledges and split-second wall jumps. Dash, cling, and don't blink.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  sfx.ui();
                  onPlay(nextLevel);
                }}
                className="rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 px-6 py-3 text-sm font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-95"
              >
                {cleared === 0 ? "Start Run" : `Continue · Level ${nextLevel}`}
              </button>
              <button
                onClick={() => {
                  sfx.ui();
                  onToggleMute();
                }}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/15"
              >
                {muted ? "🔇 Sound off" : "🔊 Sound on"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Erase all progress?")) onReset();
                }}
                className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 transition hover:text-rose-300"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-3 sm:w-auto">
            <Metric label="Cleared" value={`${cleared}/60`} accent="text-emerald-300" />
            <Metric label="Gems" value={`${gems}/180`} accent="text-cyan-300" />
            <Metric label="Deaths" value={String(deaths)} accent="text-rose-300" />
          </div>
        </div>
      </div>

      {/* tier tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TIER_COLORS.map((c, i) => {
          const unlockedTier = progress.unlocked > i * 10;
          const active = tier === i;
          return (
            <button
              key={i}
              disabled={!unlockedTier}
              onClick={() => {
                sfx.ui();
                setTier(i);
              }}
              className={`rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                active
                  ? "border-white/30 bg-white/10 text-white"
                  : unlockedTier
                    ? "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10"
                    : "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-700"
              }`}
              style={active ? { boxShadow: `0 0 24px -6px ${c.accent}`, borderColor: `${c.accent}66` } : undefined}
            >
              <span style={{ color: active ? c.accent : undefined }}>{unlockedTier ? tierName(i) : "🔒 Locked"}</span>
              <span className="ml-2 text-[10px] text-slate-500">{i * 10 + 1}–{i * 10 + 10}</span>
            </button>
          );
        })}
      </div>

      {/* grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((lv) => {
          const rec = progress.levels[lv.id];
          const unlocked = lv.id <= progress.unlocked;
          const accent = TIER_COLORS[lv.tier].accent;
          const g = rec?.gems ?? 0;
          return (
            <button
              key={lv.id}
              disabled={!unlocked}
              onClick={() => {
                sfx.ui();
                onPlay(lv.id);
              }}
              className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                unlocked
                  ? "border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09]"
                  : "cursor-not-allowed border-white/5 bg-black/30"
              }`}
            >
              {rec?.done && (
                <span
                  className="absolute right-2 top-2 text-[10px] font-black uppercase tracking-widest"
                  style={{ color: accent }}
                >
                  ✓
                </span>
              )}
              <div className="flex items-baseline gap-2">
                <span className={`font-mono text-2xl font-black ${unlocked ? "text-white" : "text-slate-700"}`}>
                  {String(lv.id).padStart(2, "0")}
                </span>
                {!unlocked && <span className="text-xs text-slate-600">🔒</span>}
              </div>
              <div className={`mt-0.5 truncate text-[11px] font-bold uppercase tracking-wider ${unlocked ? "text-slate-400" : "text-slate-700"}`}>
                {unlocked ? lv.name : "Locked"}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rotate-45 rounded-[2px] border ${
                        g & (1 << i) ? "border-cyan-200 bg-cyan-300 shadow-[0_0_8px_#22d3ee]" : "border-white/15 bg-white/5"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-slate-500">{rec?.done ? fmtTime(rec.best) : `par ${lv.parTime.toFixed(0)}s`}</span>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 h-[3px] opacity-40 transition group-hover:opacity-100"
                style={{ background: unlocked ? accent : "transparent" }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Tip title="Wall Jump" text="Press toward a wall in mid-air to cling and slide, then Space to launch off." />
        <Tip title="Air Dash" text="Shift dashes in any of 8 directions. It recharges when you touch ground or a wall." />
        <Tip title="Keep Moving" text="Orange platforms crumble the moment you land. Lasers and saws are on strict timers." />
      </div>
      <p className="mt-6 text-center text-[11px] uppercase tracking-[0.3em] text-slate-600">Built for keyboard · Touch controls supported</p>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center">
      <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`font-mono text-lg font-black ${accent}`}>{value}</div>
    </div>
  );
}

function Tip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-200">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{text}</div>
    </div>
  );
}
