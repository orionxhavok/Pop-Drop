import { playClack, playDrop, playWin, unlockAudio } from "./audio";
import { PhysicsRace } from "./physics";
import { raceField } from "./roster";
import { COURSE_COUNT, COURSE_NAMES, buildTrack } from "./track";

export type Phase = "title" | "pick" | "racing" | "results";

export type Standing = {
  id: string;
  name: string;
  color: string;
  place: number | null;
  finished: boolean;
  progress: number;
  yours: boolean;
};

export type Snap = {
  phase: Phase;
  ready: boolean;
  stars: number;
  course: number;
  courseCount: number;
  courseName: string;
  blurb: string;
  sound: boolean;
  fast: boolean;
  favoriteId: string;
  marbles: Standing[];
  leaderName: string;
  canNext: boolean;
  unlocked: number;
  courseNames: string[];
  yourPlace: number | null;
  starsEarned: number;
};

type Save = {
  version: 1;
  stars: number;
  unlocked: number;
  current: number;
  sound: boolean;
  fast: boolean;
  favorite: string;
};

const KEY = "pop-drop-v1";

function defaultSave(): Save {
  return { version: 1, stars: 0, unlocked: 1, current: 1, sound: true, fast: false, favorite: "pip" };
}

function loadSave(): Save {
  const base = defaultSave();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Save>;
    const unlocked = Math.min(COURSE_COUNT, Math.max(1, Number(parsed.unlocked) || 1));
    const current = Math.min(unlocked, Math.max(1, Number(parsed.current) || 1));
    return {
      version: 1,
      stars: Math.max(0, Number(parsed.stars) || 0),
      unlocked,
      current,
      sound: parsed.sound !== false,
      fast: parsed.fast === true,
      favorite: typeof parsed.favorite === "string" ? parsed.favorite : "pip",
    };
  } catch {
    return base;
  }
}

export class Park {
  private listeners = new Set<() => void>();
  private save: Save = defaultSave();
  private phase: Phase = "title";
  private snap: Snap;
  private race: PhysicsRace | null = null;
  private awarded = false;
  private starsEarned = 0;
  private uiAcc = 0;
  private demoHold = 0;
  private hydrated = false;

  constructor() {
    this.snap = this.compose();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snap;

  bind(race: PhysicsRace) {
    this.race = race;
    if (!this.hydrated) {
      this.save = loadSave();
      this.hydrated = true;
    }
    race.fast = false;
    race.load(buildTrack(0), raceField(), true);
    this.phase = "title";
    this.publish();
  }

  frame(dt: number) {
    const race = this.race;
    if (!race) return;
    race.fast = this.phase === "title" ? false : this.save.fast;
    race.frame(dt);
    if (this.save.sound) {
      for (const fx of race.pullFx()) playClack(true, fx.mag);
    } else {
      race.pullFx();
    }
    if (this.phase === "title" && race.over) {
      this.demoHold += dt;
      if (this.demoHold > 2.2) {
        this.demoHold = 0;
        race.load(buildTrack((Math.floor(race.time) + 1) % COURSE_COUNT), raceField(), true);
      }
    }
    if (this.phase === "racing" && race.over && !this.awarded) this.award();
    this.uiAcc += dt;
    if (this.uiAcc > 0.12 || race.over) {
      this.uiAcc = 0;
      this.publish();
    }
  }

  seat() {
    if (!this.race) return;
    unlockAudio();
    this.awarded = false;
    this.starsEarned = 0;
    this.demoHold = 0;
    this.phase = "pick";
    this.race.fast = this.save.fast;
    this.race.load(buildTrack(this.save.current - 1), raceField(), false);
    this.publish();
  }

  go() {
    if (!this.race) return;
    unlockAudio();
    if (this.phase !== "pick") this.seat();
    this.phase = "racing";
    this.race.openGate();
    if (this.save.sound) playDrop(true);
    this.publish();
  }

  again() {
    this.seat();
    this.go();
  }

  next() {
    this.selectCourse(this.save.current + 1);
  }

  selectCourse(n: number) {
    if (!this.race) return;
    if (this.phase === "racing") return;
    if (n < 1 || n > this.save.unlocked || n > COURSE_COUNT) return;
    const samePick = n === this.save.current && this.phase === "pick";
    this.save.current = n;
    this.persist();
    if (samePick) {
      this.publish();
      return;
    }
    this.awarded = false;
    this.starsEarned = 0;
    this.demoHold = 0;
    this.phase = "pick";
    this.race.fast = this.save.fast;
    this.race.load(buildTrack(n - 1), raceField(), false);
    this.publish();
  }

  setFavorite(id: string) {
    if (this.phase === "racing") return;
    this.save.favorite = id;
    this.persist();
    this.publish();
  }

  toggleSound() {
    this.save.sound = !this.save.sound;
    this.persist();
    this.publish();
  }

  toggleFast() {
    this.save.fast = !this.save.fast;
    this.persist();
    if (this.race && this.phase !== "title") this.race.fast = this.save.fast;
    this.publish();
  }

  primary() {
    if (this.phase === "title" || this.phase === "results") this.seat();
    else if (this.phase === "pick") this.go();
  }

  private award() {
    this.awarded = true;
    const yours = this.race?.marbles.find((m) => m.id === this.save.favorite);
    const place = yours?.place ?? this.race?.marbles.length ?? 6;
    const earned = place === 1 ? 3 : place === 2 ? 2 : place === 3 ? 1 : 0;
    this.starsEarned = earned;
    this.save.stars += earned;
    if (this.save.current === this.save.unlocked && this.save.unlocked < COURSE_COUNT) this.save.unlocked += 1;
    this.phase = "results";
    this.persist();
    if (this.save.sound) playWin(earned > 0);
  }

  private persist() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.save));
    } catch {
      /* ignore quota */
    }
  }

  private publish() {
    this.snap = this.compose();
    for (const fn of this.listeners) fn();
  }

  private compose(): Snap {
    const race = this.race;
    const marbles: Standing[] = (race?.marbles ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      place: m.place,
      finished: m.finished,
      progress: m.progress,
      yours: m.id === this.save.favorite,
    }));
    const racing = [...marbles].sort((a, b) => {
      if (a.place != null && b.place != null) return a.place - b.place;
      if (a.place != null) return -1;
      if (b.place != null) return 1;
      return b.progress - a.progress;
    });
    const leader = racing[0];
    const yours = marbles.find((m) => m.yours);
    const track = race?.track;
    return {
      phase: this.phase,
      ready: Boolean(race),
      stars: this.save.stars,
      course: this.save.current,
      courseCount: COURSE_COUNT,
      courseName: track?.name ?? "Sunny Bowl",
      blurb: track?.blurb ?? "One funnel, then three mouths.",
      sound: this.save.sound,
      fast: this.save.fast,
      favoriteId: this.save.favorite,
      marbles: racing,
      leaderName: leader?.name ?? "Ready",
      yourPlace: yours?.place ?? null,
      starsEarned: this.starsEarned,
      canNext: this.save.current < this.save.unlocked,
      unlocked: this.save.unlocked,
      courseNames: COURSE_NAMES.slice(),
    };
  }
}
