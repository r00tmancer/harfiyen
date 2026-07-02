import { useEffect, useRef } from 'react';
import { TARGET_SCORE } from '@harfiyen/shared';
import { jelly } from '../fx/anim';
import { useRemaining, up } from '../hooks';

// oyuncu rengi: katilim sirasina gore css degiskenleri
export const PLAYER_CSS = [
  { main: 'var(--p1)', dark: 'var(--p1-dark)', soft: 'var(--p1-soft)' },
  { main: 'var(--p2)', dark: 'var(--p2-dark)', soft: 'var(--p2-soft)' },
] as const;

function Star({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2.6l2.9 5.9 6.5 1-4.7 4.5 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.5 6.5-1z"
        fill={filled ? 'var(--sun)' : 'var(--card)'}
        stroke={filled ? 'var(--ink)' : 'var(--ink-soft)'}
        strokeWidth={1.8}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.45}
      />
    </svg>
  );
}

// 5 yildiz yuvasi; yeni dolan yildiz jelly ziplar
export function Stars({ score, size = 20 }: { score: number; size?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const prev = useRef(score);
  useEffect(() => {
    if (score > prev.current && wrap.current) {
      const el = wrap.current.children[score - 1];
      if (el) jelly(el);
    }
    prev.current = score;
  }, [score]);
  return (
    <div ref={wrap} className="flex gap-0.5" aria-label={`${score} yıldız`}>
      {Array.from({ length: TARGET_SCORE }, (_, i) => (
        <span key={i} className="inline-flex">
          <Star filled={i < score} size={size} />
        </span>
      ))}
    </div>
  );
}

export function TimerBar({ deadline, total }: { deadline: number | null; total: number }) {
  const rem = useRemaining(deadline);
  const pct = Math.max(0, Math.min(100, (rem / total) * 100));
  return (
    <div className="timer-track" role="timer" aria-label="Kalan süre">
      <div className={pct < 25 ? 'timer-fill low' : 'timer-fill'} style={{ width: `${pct}%` }} />
    </div>
  );
}

// oda kodu harf taslari halinde
export function CodeTiles({ code }: { code: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {code.split('').map((ch, i) => (
        <span key={i} className={`tile tile-sm ${i % 2 === 0 ? 'tile-rot-l' : 'tile-rot-r'}`}>
          {up(ch)}
        </span>
      ))}
    </div>
  );
}

export function WaitingDots() {
  return (
    <span className="dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

// kazanan renk yikamasi: ben kazandim -> mavi, rakip -> toz pembe; icerigin arkasinda
export function WinWash({ mine }: { mine: boolean }) {
  return (
    <div
      className="win-wash"
      style={{
        background: `color-mix(in srgb, ${mine ? 'var(--p2-soft)' : 'var(--p1-soft)'} 70%, transparent)`,
      }}
      aria-hidden="true"
    />
  );
}
