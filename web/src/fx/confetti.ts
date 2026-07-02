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
