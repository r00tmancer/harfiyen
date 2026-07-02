// Dosyasiz sentez sesler — bkz. DESIGN.md "Ses"
const MUTE_KEY = 'harfiyen:muted';

let ctx: AudioContext | null = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// ilk kullanici jestinde context'i uyandir
export function initSfx(): void {
  const resume = () => {
    const c = ensureCtx();
    if (c && c.state === 'suspended') void c.resume();
  };
  window.addEventListener('pointerdown', resume, { passive: true });
  window.addEventListener('keydown', resume);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  return muted;
}

function tone(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  gain = 0.12,
  at = 0,
): void {
  if (muted) return;
  const c = ensureCtx();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function pop(): void {
  tone('sine', 880, 1320, 0.08, 0.14);
}

export function buzz(): void {
  tone('square', 110, 110, 0.15, 0.07);
}

export function tick(): void {
  tone('triangle', 1568, 1568, 0.04, 0.12);
}

// C-E-G-C arpej
export function fanfare(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone('sine', f, f, 0.22, 0.13, i * 0.13));
  tone('triangle', 1046.5, 1046.5, 0.5, 0.06, notes.length * 0.13);
}
