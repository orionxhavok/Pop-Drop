import type { Park, Snap } from "@/game/park";
import { ROSTER } from "@/game/roster";

function placeWord(place: number | null) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  if (place == null) return "—";
  return `${place}th`;
}

export function Panel({ park, snap }: { park: Park; snap: Snap }) {
  if (snap.phase === "title") {
    return (
      <aside className="panel">
        <div className="panel-scroll">
          <p className="kicker">How a drop works</p>
          <h1 className="display panel-title">Pick a marble. Gravity does the rest.</h1>
          <ol className="rules">
            <li>
              <span>They really roll.</span> Speed comes from the slope, not a hidden path. Bumps send them sideways.
            </li>
            <li>
              <span>Bowls do not move.</span> A marble spins around the funnel and falls through the hole in the bottom.
            </li>
            <li>
              <span>Three mouths.</span> Mint is short and steep. Orange is the middle. Pink snakes the long way, so unlucky marbles get there late.
            </li>
          </ol>
        </div>
        <div className="dock">
          <button type="button" className="btn btn-primary" onClick={() => park.seat()} disabled={!snap.ready}>
            Let’s roll
          </button>
          <p className="hint">Space starts a drop. M toggles sound.</p>
        </div>
      </aside>
    );
  }

  const yours = snap.marbles.find((m) => m.yours);

  return (
    <aside className="panel">
      <div className="panel-scroll">
        <p className="kicker">
          Track {snap.course} of {snap.courseCount} · {snap.courseName}
        </p>
        <h1 className="display panel-title">{snap.phase === "results" ? "Nice drop" : snap.blurb}</h1>
        {snap.phase === "results" ? (
          <div className="result-card">
            <p className="kicker">Your marble</p>
            <p className="result-place">{placeWord(snap.yourPlace)}</p>
            <p className="result-copy">
              {yours?.name ?? "Your marble"} got {snap.starsEarned} {snap.starsEarned === 1 ? "star" : "stars"}.
              {snap.yourPlace === 1 ? " First through the finish." : " The pink snake is the slow way down."}
            </p>
          </div>
        ) : null}
        {snap.phase === "pick" || snap.phase === "results" ? (
          <div className="track-row" role="tablist" aria-label="Tracks">
            {snap.courseNames.map((name, i) => {
              const n = i + 1;
              const open = n <= snap.unlocked;
              return (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={n === snap.course}
                  disabled={!open}
                  className={n === snap.course ? "track-btn track-on" : "track-btn"}
                  onClick={() => park.selectCourse(n)}
                >
                  <span className="track-num">{n}</span>
                  <span className="track-name">{open ? name : "Locked"}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {snap.phase === "pick" ? (
          <div className="picker" role="listbox" aria-label="Choose your marble">
            {ROSTER.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={m.id === snap.favoriteId}
                className={m.id === snap.favoriteId ? "pick pick-on" : "pick"}
                onClick={() => park.setFavorite(m.id)}
              >
                <span className="pick-ball" style={{ background: m.color }} />
                <span className="pick-name">{m.name}</span>
                {m.id === snap.favoriteId ? <span className="pick-you">You</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <ol className="order">
            {snap.marbles.map((m) => (
              <li key={m.id} className={m.yours ? "order-row order-you" : "order-row"}>
                <span className="place">{m.place ?? "·"}</span>
                <span className="swatch" style={{ background: m.color }} />
                <span className="order-name">
                  {m.name}
                  {m.yours ? <span className="you-tag">You</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="dock">
        {snap.phase === "pick" ? (
          <button type="button" className="btn btn-primary" onClick={() => park.go()}>
            GO
          </button>
        ) : null}
        {snap.phase === "racing" ? (
          <button type="button" className="btn btn-primary" disabled>
            Rolling…
          </button>
        ) : null}
        {snap.phase === "results" ? (
          <div className="dock-row">
            <button type="button" className="btn btn-primary" onClick={() => park.again()}>
              Run it again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => park.next()} disabled={!snap.canNext}>
              Next track
            </button>
          </div>
        ) : null}
        <div className="tool-row">
          <button type="button" className={snap.fast ? "chip chip-on" : "chip"} onClick={() => park.toggleFast()} aria-pressed={snap.fast}>
            {snap.fast ? "Zip on" : "Zip"}
          </button>
          <button type="button" className="chip" onClick={() => park.toggleSound()} aria-pressed={snap.sound}>
            {snap.sound ? "Sound" : "Muted"}
          </button>
        </div>
      </div>
    </aside>
  );
}
