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
