import confetti from 'canvas-confetti';

// oyuncu paletleri (kazananin renginde konfeti)
export const P1_COLORS = ['#FF6FA9', '#E44B8D', '#FFE1EE', '#FFC93C'];
export const P2_COLORS = ['#4FB8FF', '#2E9BE8', '#E0F2FF', '#FFC93C'];

export function paletteFor(index: 0 | 1): string[] {
  return index === 1 ? P2_COLORS : P1_COLORS;
}

let instance: confetti.CreateTypes | null = null;

function ensure(): confetti.CreateTypes {
  if (instance) return instance;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  document.body.appendChild(canvas);
  instance = confetti.create(canvas, { resize: true, useWorker: true });
  return instance;
}

// kucuk patlama (kabul edilen kelime)
export function burst(colors: string[], origin?: { x: number; y: number }): void {
  void ensure()({
    particleCount: 55,
    spread: 75,
    startVelocity: 38,
    gravity: 1.1,
    ticks: 130,
    scalar: 0.95,
    origin: origin ?? { x: 0.5, y: 0.62 },
    colors,
    disableForReducedMotion: true,
  });
}

// ---- telepati: kalp partikülleri (pembe tonlar, emoji degil path) ----
const HEART_COLORS = ['#FF6FA9', '#E44B8D', '#FFB3D1', '#FF8FBE'];
const HEART_PATH =
  'M12 20.4S4.6 15.9 2.5 11.2C1 7.9 3 4.6 6.4 4.6c2.2 0 3.9 1.3 5.6 3.3 1.7-2 3.4-3.3 5.6-3.3 3.4 0 5.4 3.3 3.9 6.6-2.1 4.7-9.5 9.2-9.5 9.2z';

let heartShapes: confetti.Shape[] | null = null;
function hearts(): confetti.Shape[] {
  if (!heartShapes) {
    try {
      heartShapes = [confetti.shapeFromPath({ path: HEART_PATH })];
    } catch {
      heartShapes = []; // Path2D yoksa varsayilan sekillerle devam
    }
  }
  return heartShapes;
}

// eslesme ani: ekranin ortasindan kalp fiskirmasi
export function heartBurst(): void {
  void ensure()({
    particleCount: 45,
    spread: 100,
    startVelocity: 32,
    gravity: 0.85,
    ticks: 160,
    scalar: 1.6,
    shapes: hearts(),
    origin: { x: 0.5, y: 0.5 },
    colors: HEART_COLORS,
    disableForReducedMotion: true,
  });
}

// zafer ekrani: 2 sn kalp yagmuru (yuksek uyum yuzdesi)
export function heartRain(): void {
  const shoot = () => {
    void ensure()({
      particleCount: 7,
      angle: 270,
      spread: 140,
      startVelocity: 14,
      gravity: 0.7,
      ticks: 240,
      scalar: 1.5,
      shapes: hearts(),
      origin: { x: Math.random(), y: -0.12 },
      colors: HEART_COLORS,
      disableForReducedMotion: true,
    });
  };
  shoot();
  const id = window.setInterval(shoot, 150);
  window.setTimeout(() => window.clearInterval(id), 2000);
}

// 2 sn konfeti yagmuru (zafer)
export function rain(colors: string[]): void {
  const shoot = () => {
    void ensure()({
      particleCount: 9,
      angle: 270,
      spread: 140,
      startVelocity: 16,
      gravity: 0.85,
      ticks: 220,
      origin: { x: Math.random(), y: -0.12 },
      colors,
      disableForReducedMotion: true,
    });
  };
  shoot();
  const id = window.setInterval(shoot, 140);
  window.setTimeout(() => window.clearInterval(id), 2000);
}
