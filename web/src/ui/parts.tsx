import { useEffect, useRef } from 'react';
import { SAYI_ROUNDS_TO_WIN, TARGET_SCORE, ZINCIR_LIVES } from '@harfiyen/shared';
import { jelly, wobble } from '../fx/anim';
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

// kalp: zincir modunda can gostergesi
function Heart({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 20.4S4.6 15.9 2.5 11.2C1 7.9 3 4.6 6.4 4.6c2.2 0 3.9 1.3 5.6 3.3 1.7-2 3.4-3.3 5.6-3.3 3.4 0 5.4 3.3 3.9 6.6-2.1 4.7-9.5 9.2-9.5 9.2z"
        fill={filled ? 'var(--p1)' : 'var(--card)'}
        stroke={filled ? 'var(--ink)' : 'var(--ink-soft)'}
        strokeWidth={1.8}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.4}
      />
    </svg>
  );
}

// 3 can yuvasi; can gidince kalan dizi sallanir
export function Hearts({ lives, size = 18 }: { lives: number; size?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const prev = useRef(lives);
  useEffect(() => {
    if (lives < prev.current) wobble(wrap.current);
    prev.current = lives;
  }, [lives]);
  return (
    <div ref={wrap} className="flex gap-0.5" aria-label={`${lives} can`}>
      {Array.from({ length: ZINCIR_LIVES }, (_, i) => (
        <span key={i} className="inline-flex">
          <Heart filled={i < lives} size={size} />
        </span>
      ))}
    </div>
  );
}

// sayi avi: 3 madalya noktasi (kazanilan raundlar)
export function MedalDots({ wins, size = 16 }: { wins: number; size?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const prev = useRef(wins);
  useEffect(() => {
    if (wins > prev.current && wrap.current) {
      const el = wrap.current.children[wins - 1];
      if (el) jelly(el);
    }
    prev.current = wins;
  }, [wins]);
  return (
    <div ref={wrap} className="flex items-center gap-1" aria-label={`${wins} raund`}>
      {Array.from({ length: SAYI_ROUNDS_TO_WIN }, (_, i) => (
        <span key={i} className="inline-flex">
          <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
            <circle
              cx={10}
              cy={10}
              r={7.4}
              fill={i < wins ? 'var(--sun)' : 'var(--card)'}
              stroke={i < wins ? 'var(--ink)' : 'var(--ink-soft)'}
              strokeWidth={2}
              opacity={i < wins ? 1 : 0.45}
            />
            {i < wins && <circle cx={10} cy={10} r={2.6} fill="var(--ink)" opacity={0.35} />}
          </svg>
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
