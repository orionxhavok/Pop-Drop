let ctx: AudioContext | null = null;
let lastClack = 0;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

function tone(freq: number, dur: number, peak: number, type: OscillatorType, at = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playClick(on: boolean) {
  if (!on) return;
  tone(520, 0.05, 0.03, "triangle");
}

export function playDrop(on: boolean) {
  if (!on) return;
  tone(180, 0.12, 0.05, "sine");
  tone(90, 0.18, 0.04, "sine", 0.02);
}

export function playClack(on: boolean, mag: number) {
  if (!on) return;
  const c = ac();
  if (!c) return;
  const now = c.currentTime;
  if (now - lastClack < 0.045) return;
  lastClack = now;
  const peak = Math.min(0.08, 0.02 + mag / 8000);
  tone(280 + Math.random() * 220, 0.04, peak, "triangle");
}

export function playFee(on: boolean) {
  if (!on) return;
  tone(660, 0.08, 0.035, "sine");
  tone(880, 0.1, 0.025, "sine", 0.05);
}

export function playWin(on: boolean) {
  if (!on) return;
  tone(523, 0.12, 0.04, "sine");
  tone(659, 0.14, 0.04, "sine", 0.08);
  tone(784, 0.2, 0.045, "sine", 0.16);
}

export function playLose(on: boolean) {
  if (!on) return;
  tone(220, 0.14, 0.03, "sine");
  tone(174, 0.18, 0.025, "sine", 0.08);
}
