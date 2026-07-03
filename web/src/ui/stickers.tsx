import type { JSX } from 'react';
import { REACTION_COUNT } from '@harfiyen/shared';

// 6 tepki sticker'i: avatar diliyle ayni govdeler ama yuz ifadeleri abartili.
// Sira, protokoldeki sticker id'leriyle (0..REACTION_COUNT-1) birebir eslesir.
export const STICKER_NAMES = [
  'Gülen yıldız',
  'Kalp gözlü kalp',
  'Öfkeli şimşek',
  'Ağlayan damla',
  'Alkışlayan çiçek',
  'Şaşkın elmas',
] as const;

// mini kalp (goz) ve gozyasi damlasi yollari; merkez (0,0)
const MINI_HEART =
  'M0 3.4 C-3.8 1 -5 -1.6 -3.4 -3.3 C-2.1 -4.7 -0.6 -4 0 -2.7 C0.6 -4 2.1 -4.7 3.4 -3.3 C5 -1.6 3.8 1 0 3.4 Z';
const TEAR =
  'M0 -3.4 C1.9 -0.8 2.8 0.8 2.8 2.2 A2.8 2.8 0 1 1 -2.8 2.2 C-2.8 0.8 -1.9 -0.8 0 -3.4 Z';

const STICKERS: JSX.Element[] = [
  // 0 — gulen yildiz: kapali mutlu gozler + kocaman acik agiz
  <>
    <g fill="var(--sun)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 6 L39.6 22.5 L57.7 24.7 L44.4 37 L47.9 54.8 L32 46 L16.1 54.8 L19.6 37 L6.3 24.7 L24.4 22.5 Z" />
    </g>
    <g fill="none" stroke="var(--ink)" strokeWidth={2.6} strokeLinecap="round">
      <path d="M22.5 29.5 q3.2 -4.2 6.4 0" />
      <path d="M35.1 29.5 q3.2 -4.2 6.4 0" />
    </g>
    <path d="M25.5 34.5 q6.5 8.5 13 0 z" fill="var(--ink)" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
    <circle cx={19.5} cy={34} r={2.6} fill="var(--p1)" opacity={0.5} />
    <circle cx={44.5} cy={34} r={2.6} fill="var(--p1)" opacity={0.5} />
  </>,

  // 1 — kalp gozlu kalp: gozler mini kalp
  <>
    <g fill="var(--p1)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 55 C14 43 7 32 7 21 C7 12 14 6 21.5 6 C26 6 30.5 9 32 14 C33.5 9 38 6 42.5 6 C50 6 57 12 57 21 C57 32 50 43 32 55 Z" />
    </g>
    <path d={MINI_HEART} transform="translate(25 23) scale(1.3)" fill="var(--ink)" />
    <path d={MINI_HEART} transform="translate(39 23) scale(1.3)" fill="var(--ink)" />
    <path d="M27.5 31.5 q4.5 5.5 9 0 z" fill="var(--ink)" stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
    <circle cx={20.5} cy={30} r={2.4} fill="#fff" opacity={0.4} />
    <circle cx={43.5} cy={30} r={2.4} fill="#fff" opacity={0.4} />
  </>,

  // 2 — ofkeli simsek: catik kaslar + ters agiz + kizginlik isareti
  <>
    <g fill="var(--sun)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <path d="M37 3 L11 37 L27 37 L23 61 L53 25 L35 25 Z" />
    </g>
    <g fill="none" stroke="var(--ink)" strokeWidth={2.8} strokeLinecap="round">
      <path d="M24 23.5 L29.5 26.5" />
      <path d="M38 23.5 L32.5 26.5" />
      <path d="M27 37 Q31 33.5 35 37" strokeWidth={2.6} />
    </g>
    <circle cx={26.5} cy={30.5} r={2.1} fill="var(--ink)" />
    <circle cx={35.5} cy={30.5} r={2.1} fill="var(--ink)" />
    <g stroke="var(--err)" strokeWidth={2.6} strokeLinecap="round">
      <path d="M46.5 8.5 l6 6 M52.5 8.5 l-6 6" />
    </g>
  </>,

  // 3 — aglayan damla: sikilmis gozler + yanak yaslari + acik uzgun agiz
  <>
    <g fill="var(--p2)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 5 C41 18 51 27 51 39 A19 19 0 0 1 13 39 C13 27 23 18 32 5 Z" />
    </g>
    <g fill="none" stroke="var(--ink)" strokeWidth={2.6} strokeLinecap="round">
      <path d="M23.5 35.5 q3.2 3.8 6.4 0" />
      <path d="M34.1 35.5 q3.2 3.8 6.4 0" />
    </g>
    <path d={TEAR} transform="translate(22.5 45)" fill="var(--p2-soft)" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
    <path d={TEAR} transform="translate(41.5 45)" fill="var(--p2-soft)" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
    <path d="M28 48.5 q4 -5 8 0 z" fill="var(--ink)" stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
  </>,

  // 4 — alkislayan cicek: iki yan yaprak el gibi onde birlesir, carpma cizgileri
  <>
    <g fill="var(--p1)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const cx = 32 + 17 * Math.cos(rad);
        const cy = 34 + 17 * Math.sin(rad);
        return <circle key={deg} cx={cx} cy={cy} r={10.5} />;
      })}
      <circle cx={32} cy={34} r={13.5} fill="var(--card)" />
    </g>
    <g fill="none" stroke="var(--ink)" strokeWidth={2.4} strokeLinecap="round">
      <path d="M25 32.5 q2.8 -3.6 5.6 0" />
      <path d="M33.4 32.5 q2.8 -3.6 5.6 0" />
    </g>
    <path d="M27 36.5 q5 6 10 0 z" fill="var(--ink)" stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
    <g fill="var(--p1)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round">
      <ellipse cx={24.5} cy={51} rx={7} ry={5} transform="rotate(-30 24.5 51)" />
      <ellipse cx={39.5} cy={51} rx={7} ry={5} transform="rotate(30 39.5 51)" />
    </g>
    <g stroke="var(--ink-soft)" strokeWidth={2.2} strokeLinecap="round">
      <path d="M14 44 l-4.5 -2.5 M13.5 51 l-5 0.5" />
      <path d="M50 44 l4.5 -2.5 M50.5 51 l5 0.5" />
    </g>
  </>,

  // 5 — saskin elmas: kalkik kaslar + faltasi gozler + "o" agiz
  <>
    <g fill="var(--mint)" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <path d="M32 58 L6 24 L16 8 L48 8 L58 24 Z" />
    </g>
    <g fill="none" stroke="var(--ink)" strokeWidth={2.6} strokeLinecap="round">
      <path d="M22.5 16.5 q3 -3 6 0" />
      <path d="M35.5 16.5 q3 -3 6 0" />
    </g>
    <circle cx={26} cy={24.5} r={4.4} fill="#fff" stroke="var(--ink)" strokeWidth={2.2} />
    <circle cx={38} cy={24.5} r={4.4} fill="#fff" stroke="var(--ink)" strokeWidth={2.2} />
    <circle cx={26} cy={25.1} r={1.8} fill="var(--ink)" />
    <circle cx={38} cy={25.1} r={1.8} fill="var(--ink)" />
    <ellipse cx={32} cy={34.5} rx={2.7} ry={3.6} fill="var(--ink)" />
  </>,
];

export function Sticker({
  id,
  size = 48,
  className,
}: {
  id: number;
  size?: number;
  className?: string;
}) {
  const i = ((id % REACTION_COUNT) + REACTION_COUNT) % REACTION_COUNT;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={STICKER_NAMES[i]}
    >
      {STICKERS[i]}
    </svg>
  );
}
