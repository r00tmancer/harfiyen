import type { SVGProps } from 'react';

// el cizimi hissiyatinda kucuk cizgi ikonlar; renk currentColor
function base(size: number, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function IconCopy({ size = 20, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="3.5" />
      <path d="M15.5 5.5v-.7A2.3 2.3 0 0 0 13.2 2.5H5.8A2.3 2.3 0 0 0 3.5 4.8v7.4a2.3 2.3 0 0 0 2.3 2.3h.7" />
    </svg>
  );
}

export function IconCheck({ size = 20, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.5 12.8l4.6 4.7 10.4-11" />
    </svg>
  );
}

export function IconSoundOn({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 9.5v5h3.4l4.6 4V5.5l-4.6 4H4z" fill="currentColor" stroke="currentColor" strokeWidth={1.8} />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18.2 6.8a7.5 7.5 0 0 1 0 10.4" />
    </svg>
  );
}

export function IconSoundOff({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 9.5v5h3.4l4.6 4V5.5l-4.6 4H4z" fill="currentColor" stroke="currentColor" strokeWidth={1.8} />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  );
}

export function IconBack({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  );
}

export function IconTrophy({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0v-5z" />
      <path d="M7.5 6H4.8a.8.8 0 0 0-.8.8c0 2.4 1.6 4 3.6 4.4M16.5 6h2.7c.5 0 .8.36.8.8 0 2.4-1.6 4-3.6 4.4" />
      <path d="M12 14v3.2M8.8 20h6.4M10 17.2h4" />
    </svg>
  );
}

// cift yonlu ok: iki harften herhangi biriyle basla
export function IconSwap({ size = 26, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M6.5 9H19M16 5.8L19.3 9 16 12.2" />
      <path d="M17.5 15H5M8 11.8L4.7 15 8 18.2" />
    </svg>
  );
}

// kar tanesi: buz jokeri
export function IconSnowflake({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 2.8v18.4M4 7.4l16 9.2M20 7.4L4 16.6" />
      <path d="M9.6 4.9L12 7.3l2.4-2.4M9.6 19.1L12 16.7l2.4 2.4" />
    </svg>
  );
}

// iki harf tasi: harf modu
export function IconTilesDuo({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <rect x="2.5" y="4" width="11" height="11" rx="3" />
      <rect x="10.5" y="9" width="11" height="11" rx="3" />
      <path d="M6 12.2l2-4.4 2 4.4M6.7 10.8h2.6" />
      <path d="M13.8 17.5h3.4l-3.4 0M13.8 12.5h3l-3.2 5h3.6" strokeWidth={2} />
    </svg>
  );
}

// hedef tahtasi: sayi avi
export function IconTarget({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

// fitilli yuvarlak bomba: kelime zinciri
export function IconBomb({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <circle cx="10.5" cy="14" r="6.8" />
      <path d="M13.5 8.2l1.6-1.8" />
      <path d="M15.4 6.2q1.4-2.4 4-1.8" />
      <path d="M20.6 3.2l.9-.9M21.6 6l1.1.2M19.2 1.9l-.1-1.2" strokeWidth={1.9} />
    </svg>
  );
}

// cetvel: en uzun kelime
export function IconRuler({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M2.8 15.6L15.6 2.8l5.6 5.6L8.4 21.2z" />
      <path d="M7 11.4l2 2M10.2 8.2l2 2M13.4 5l2 2" strokeWidth={2} />
    </svg>
  );
}

// patlama yildizi, icinde 7: bom modu
export function IconBurst({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 2l2.2 4.6 4.9-1.7-1.7 4.9L22 12l-4.6 2.2 1.7 4.9-4.9-1.7L12 22l-2.2-4.6-4.9 1.7 1.7-4.9L2 12l4.6-2.2-1.7-4.9 4.9 1.7z" strokeWidth={2} />
      <path d="M10 9.3h4.2l-2.5 5.6" strokeWidth={2.1} />
    </svg>
  );
}

// kalkan + onay: sigorta jokeri
export function IconShield({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 2.8l7.2 2.6v6c0 4.6-3 8-7.2 9.8C7.8 19.4 4.8 16 4.8 11.4v-6z" />
      <path d="M8.9 11.6l2.2 2.3 4-4.4" strokeWidth={2.2} />
    </svg>
  );
}

// termometre: sayi avi jokeri
export function IconThermometer({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M10 4.2a2.4 2.4 0 0 1 4.8 0v9a4.4 4.4 0 1 1-4.8 0z" />
      <circle cx="12.4" cy="16.6" r="1.9" fill="currentColor" stroke="none" />
      <path d="M12.4 14.8v-6" strokeWidth={2} />
      <path d="M17.8 5.5h2.4M17.8 8.7h1.6" strokeWidth={1.9} />
    </svg>
  );
}

// pas oku: zincir jokeri, sirayi devret
export function IconPass({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M3.5 16.5h10a5 5 0 0 0 5-5V7" />
      <path d="M14.8 10.2L18.5 6.5l3.7 3.7" />
      <path d="M3.5 12.5h5" strokeWidth={2} opacity={0.6} />
    </svg>
  );
}

// cifte yildiz: uzun kelime jokeri
export function IconDoubleStar({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M9 3.5l1.7 3.4 3.8.6-2.8 2.6.7 3.8L9 12.1l-3.4 1.8.7-3.8L3.5 7.5l3.8-.6z" />
      <path d="M17.2 12.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" />
    </svg>
  );
}

// tac: en uzun kelimeyi yazan
export function IconCrown({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M4.2 18h15.6M4.2 18L3 7.5l4.8 3.7L12 4.5l4.2 6.7L21 7.5 19.8 18z" fill="currentColor" fillOpacity={0.25} />
    </svg>
  );
}

// ic ice iki kalp: telepati modu + cifte kalp jokeri
export function IconHeartsDuo({ size = 22, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M9.6 15.4S3.8 11.9 2.2 8.2C1 5.7 2.5 3.1 5.2 3.1c1.7 0 3 1 4.4 2.6 1.3-1.6 2.7-2.6 4.4-2.6 2.7 0 4.2 2.6 3 5.1-1.6 3.7-7.4 7.2-7.4 7.2z" />
      <path
        d="M17.1 20.7S13 18.2 11.9 15.7c-.8-1.9.3-3.7 2.1-3.7 1.2 0 2.1.7 3.1 1.8.9-1.1 1.9-1.8 3.1-1.8 1.9 0 3 1.8 2.1 3.6-1.2 2.6-5.2 5.1-5.2 5.1z"
        fill="currentColor"
        fillOpacity={0.25}
      />
    </svg>
  );
}

// dolu kalp: uyum sayaci + avatarlar arasi kalp
export function IconHeartSolid({ size = 16, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden {...props}>
      <path d="M12 20.4S4.6 15.9 2.5 11.2C1 7.9 3 4.6 6.4 4.6c2.2 0 3.9 1.3 5.6 3.3 1.7-2 3.4-3.3 5.6-3.3 3.4 0 5.4 3.3 3.9 6.6-2.1 4.7-9.5 9.2-9.5 9.2z" />
    </svg>
  );
}

// paylas: kutudan yukari ok
export function IconShare({ size = 20, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 14.5V3.2M8.2 6.6L12 2.8l3.8 3.8" />
      <path d="M7.5 10.5H5.7a2.2 2.2 0 0 0-2.2 2.2v6.1a2.2 2.2 0 0 0 2.2 2.2h12.6a2.2 2.2 0 0 0 2.2-2.2v-6.1a2.2 2.2 0 0 0-2.2-2.2h-1.8" />
    </svg>
  );
}

// gulen yuz: tepki butonu
export function IconSmile({ size = 24, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.6" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <path d="M8 14.2q4 3.8 8 0" />
    </svg>
  );
}

// yukari / asagi ok: tahmin sonucu
export function IconArrowUp({ size = 18, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 20V5M5.5 11L12 4.5 18.5 11" />
    </svg>
  );
}
export function IconArrowDown({ size = 18, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 4v15M5.5 13L12 19.5 18.5 13" />
    </svg>
  );
}
