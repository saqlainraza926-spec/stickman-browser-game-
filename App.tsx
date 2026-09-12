import { useCallback, useEffect, useState } from "react";
import GameView from "./components/GameView";
import LevelSelect from "./components/LevelSelect";
import { loadProgress, recordClear, saveProgress, type Progress } from "./game/progress";
import { setMuted } from "./game/audio";

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [levelId, setLevelId] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  const handleComplete = useCallback(
    (time: number, deaths: number, gems: boolean[]) => {
      setProgress((p) => recordClear(p, levelId ?? 1, time, deaths, gems));
    },
    [levelId],
  );

  const reset = () => {
    const fresh: Progress = { levels: {}, unlocked: 1 };
    saveProgress(fresh);
    setProgress(fresh);
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 antialiased selection:bg-sky-400/30">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.5]"
        style={{
          background:
            "radial-gradient(900px 500px at 12% -10%, rgba(56,189,248,0.16), transparent 60%), radial-gradient(800px 500px at 95% 110%, rgba(52,211,153,0.12), transparent 60%)",
        }}
      />
      <div className="relative">
        {levelId === null ? (
          <LevelSelect
            progress={progress}
            onPlay={(id) => setLevelId(id)}
            onReset={reset}
            muted={muted}
            onToggleMute={() => setMutedState((m) => !m)}
          />
        ) : (
          <GameView
            key={levelId}
            levelId={levelId}
            best={progress.levels[levelId]?.done ? progress.levels[levelId].best : undefined}
            onExit={() => setLevelId(null)}
            onComplete={handleComplete}
            onNext={() => setLevelId((id) => Math.min(60, (id ?? 1) + 1))}
          />
        )}
      </div>
    </div>
  );
}
