import { gsap } from 'gsap';

export function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// ekran acilisi: [data-pop] isaretli cocuklar zipla-yerles
export function staggerIn(root: HTMLElement | null): void {
  if (!root || reducedMotion()) return;
  const els = root.querySelectorAll('[data-pop]');
  if (els.length === 0) return;
  gsap.from(els, {
    y: 26,
    scale: 0.94,
    opacity: 0,
    duration: 0.5,
    stagger: 0.07,
    ease: 'back.out(1.7)',
    clearProps: 'all',
  });
}

export function popIn(el: Element | null, delay = 0): void {
  if (!el || reducedMotion()) return;
  gsap.from(el, {
    scale: 0.55,
    y: 18,
    opacity: 0,
    duration: 0.45,
    delay,
    ease: 'back.out(1.9)',
    clearProps: 'all',
  });
}

// red: x ekseninde wobble
export function wobble(el: Element | null): void {
  if (!el || reducedMotion()) return;
  gsap.to(el, {
    keyframes: [
      { x: -11, duration: 0.06 },
      { x: 9, duration: 0.06 },
      { x: -7, duration: 0.06 },
      { x: 5, duration: 0.06 },
      { x: 0, duration: 0.08 },
    ],
    ease: 'power1.inOut',
    clearProps: 'x',
  });
}

// geri sayim rakami: buyukten yerine oturma
export function punchIn(el: Element | null): void {
  if (!el) return;
  if (reducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 1.6, opacity: 0.4 },
    { scale: 1, opacity: 1, duration: 0.42, ease: 'back.out(2.4)' },
  );
}

// harf tasi yukaridan duser, seker gibi seker
export function dropIn(el: Element | null, delay = 0): void {
  if (!el || reducedMotion()) return;
  gsap.from(el, {
    y: -240,
    rotation: () => gsap.utils.random(-15, 15),
    duration: 0.75,
    delay,
    ease: 'bounce.out',
    clearProps: 'transform',
  });
}

// jelly: yildiz dolunca
export function jelly(el: Element | null): void {
  if (!el || reducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 0 },
    { scale: 1, duration: 0.65, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' },
  );
}

// kabul pop: olcek vurgusu
export function acceptPunch(el: Element | null): void {
  if (!el || reducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 1.25 },
    { scale: 1, duration: 0.4, ease: 'back.out(3)', clearProps: 'transform' },
  );
}
