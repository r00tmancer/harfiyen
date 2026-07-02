import type { JSX } from 'react';

// 8 kawaii karakter: iki nokta goz + gulumseme, govde rengi prop ile boyanir.
export const AVATAR_NAMES = [
  'Yıldız',
  'Kalp',
  'Bulut',
  'Şimşek',
  'Damla',
  'Çiçek',
  'Elmas',
  'Ay',
] as const;

// ana ekrandaki secicide her sekle yakisan seker rengi
export const AVATAR_PICK_COLORS = [
  '#FFC93C',
  '#FF6FA9',
  '#4FB8FF',
  '#FFC93C',
  '#4FB8FF',
  '#FF6FA9',
  '#3EDBB2',
  '#A78BFA',
] as const;

function Face({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <circle cx={x - 5.5 * s} cy={y - 2 * s} r={2.3 * s} fill="var(--ink)" stroke="none" />
      <circle cx={x + 5.5 * s} cy={y - 2 * s} r={2.3 * s} fill="var(--ink)" stroke="none" />
      <path
        d={`M ${x - 4.5 * s} ${y + 3 * s} Q ${x} ${y + 7.5 * s} ${x + 4.5 * s} ${y + 3 * s}`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={2.4 * s}
        strokeLinecap="round"
      />
    </g>
  );
}

interface ShapeDef {
  body: JSX.Element;
  face: { x: number; y: number; s?: number };
}

const SHAPES: ShapeDef[] = [
  {
    // yildiz
    body: (
      <path d="M32 6 L39.6 22.5 L57.7 24.7 L44.4 37 L47.9 54.8 L32 46 L16.1 54.8 L19.6 37 L6.3 24.7 L24.4 22.5 Z" />
    ),
    face: { x: 32, y: 32, s: 0.85 },
  },
  {
    // kalp
    body: (
      <path d="M32 55 C14 43 7 32 7 21 C7 12 14 6 21.5 6 C26 6 30.5 9 32 14 C33.5 9 38 6 42.5 6 C50 6 57 12 57 21 C57 32 50 43 32 55 Z" />
    ),
    face: { x: 32, y: 26 },
  },
  {
    // bulut
    body: (
      <path d="M20 48 H46 A11 11 0 0 0 48.5 26.3 A14 14 0 0 0 21.5 22 A11.5 11.5 0 0 0 20 48 Z" />
    ),
    face: { x: 33, y: 36, s: 0.9 },
  },
  {
    // simsek
    body: <path d="M37 3 L11 37 L27 37 L23 61 L53 25 L35 25 Z" />,
    face: { x: 31, y: 29, s: 0.75 },
  },
  {
    // damla
    body: (
      <path d="M32 5 C41 18 51 27 51 39 A19 19 0 0 1 13 39 C13 27 23 18 32 5 Z" />
    ),
    face: { x: 32, y: 39 },
  },
  {
    // cicek: 6 tac yaprak + beyaz merkez
    body: (
      <>
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const cx = 32 + 17 * Math.cos(rad);
          const cy = 34 + 17 * Math.sin(rad);
          return <circle key={deg} cx={cx} cy={cy} r={10.5} />;
        })}
        <circle cx={32} cy={34} r={13.5} fill="var(--card)" />
      </>
    ),
    face: { x: 32, y: 34, s: 0.85 },
  },
  {
    // elmas
    body: <path d="M32 58 L6 24 L16 8 L48 8 L58 24 Z" />,
    face: { x: 32, y: 26 },
  },
  {
    // ay
    body: <path d="M55 34 A24 24 0 1 1 29 8 A18.6 18.6 0 0 0 55 34 Z" />,
    face: { x: 27, y: 36, s: 0.9 },
  },
];

export function Avatar({
  index,
  color,
  size = 56,
  className,
}: {
  index: number;
  color: string;
  size?: number;
  className?: string;
}) {
  const i = ((index % SHAPES.length) + SHAPES.length) % SHAPES.length;
  const def = SHAPES[i];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={AVATAR_NAMES[i]}
    >
      <g fill={color} stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {def.body}
      </g>
      <Face x={def.face.x} y={def.face.y} s={def.face.s} />
    </svg>
  );
}
