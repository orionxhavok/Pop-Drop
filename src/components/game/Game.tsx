import { useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";
import { Star, Volume2, VolumeX } from "lucide-react";
import { Park } from "@/game/park";
import { Panel } from "@/components/game/Panel";

export function Game() {
  const parkRef = useRef<Park | null>(null);
  if (!parkRef.current) parkRef.current = new Park();
  const park = parkRef.current;
  const snap = useSyncExternalStore(park.subscribe, park.getSnapshot, park.getSnapshot);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let cancel = false;
    let raf = 0;
    let view: { dispose: () => void } | null = null;

    void Promise.all([import("@/game/physics"), import("@/game/view3d")]).then(async ([physics, viewMod]) => {
      if (cancel) return;
      const race = new physics.PhysicsRace();
      await race.init();
      if (cancel) {
        race.dispose();
        return;
      }
      const raceView = new viewMod.RaceView(canvas);
      park.bind(race);
      const resize = () => {
        const rect = wrap.getBoundingClientRect();
        raceView.setSize(rect.width, rect.height);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      resize();
      let last = performance.now();
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        park.frame(dt);
        raceView.render(race, dt, park.getSnapshot().favoriteId);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const onKey = (e: KeyboardEvent) => {
        if (e.code !== "Space" && e.code !== "KeyM") return;
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        if (e.code === "KeyM") park.toggleSound();
        else park.primary();
      };
      window.addEventListener("keydown", onKey);
      view = {
        dispose: () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          window.removeEventListener("keydown", onKey);
          raceView.dispose();
          race.dispose();
        },
      };
    });

    return () => {
      cancel = true;
      cancelAnimationFrame(raf);
      view?.dispose();
    };
  }, [park]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="display wordmark">Pop Drop</p>
          <p className="meta">
            {snap.phase === "title" ? "Marbles, gravity, and a hole in the bowl" : `Track ${snap.course} of ${snap.courseCount}`}
          </p>
        </div>
        <div className="star-pill">
          <Star size={16} aria-hidden="true" />
          <span className="display stars">{snap.stars}</span>
          <span className="meta">stars</span>
        </div>
        <button type="button" className="icon-btn" onClick={() => park.toggleSound()} aria-pressed={snap.sound} aria-label={snap.sound ? "Mute" : "Sound on"}>
          {snap.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </header>
      <div className="layout">
        <div className="stage">
          <div className="canvas-wrap" ref={wrapRef}>
            <canvas ref={canvasRef} className="track" aria-label="Marble track" />
          </div>
          {snap.phase === "title" ? (
            <div className="lockup">
              <p className="kicker">Marble park</p>
              <p className="display lockup-title">Watch them drop.</p>
              <p className="lede">Bowls stay put. Marbles spin down a hole, then fall into a fast mint chute or the long pink snake.</p>
            </div>
          ) : (
            <div className="hud">
              <div>
                <p className="kicker">{snap.phase === "results" ? "Winner" : "Ahead"}</p>
                <p className="hud-name">{snap.leaderName}</p>
                <p className="legend">Pink is the long snake. Mint is the quick drop.</p>
              </div>
            </div>
          )}
          {snap.phase !== "title" ? (
            <div className="railbar" aria-hidden="true">
              {snap.marbles.map((m) => (
                <span
                  key={m.id}
                  className={m.yours ? "pip pip-you" : "pip"}
                  style={{ left: `${Math.round(m.progress * 1000) / 10}%`, background: m.color }}
                />
              ))}
            </div>
          ) : null}
          {!snap.ready ? <p className="toast">Setting the track…</p> : null}
        </div>
        <Panel park={park} snap={snap} />
      </div>
    </div>
  );
}
