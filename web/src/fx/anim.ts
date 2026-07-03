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

// bomba patlamasi: tum ekran sarsintisi
export function shake(el: Element | null): void {
  if (!el || reducedMotion()) return;
  gsap.to(el, {
    keyframes: [
      { x: -14, y: 6, duration: 0.05 },
      { x: 12, y: -6, duration: 0.05 },
      { x: -9, y: 4, duration: 0.05 },
      { x: 7, y: -3, duration: 0.05 },
      { x: -4, y: 2, duration: 0.05 },
      { x: 0, y: 0, duration: 0.07 },
    ],
    ease: 'power1.inOut',
    clearProps: 'x,y',
  });
}

// dogru BOM: kisa mikro sarsinti (tam patlama shake'inden hafif)
export function microShake(el: Element | null): void {
  if (!el || reducedMotion()) return;
  gsap.to(el, {
    keyframes: [
      { x: -6, y: 3, duration: 0.045 },
      { x: 5, y: -3, duration: 0.045 },
      { x: -3, y: 2, duration: 0.045 },
      { x: 0, y: 0, duration: 0.06 },
    ],
    ease: 'power1.inOut',
    clearProps: 'x,y',
  });
}

// uzun kelime karti: rotateY ile acilis (flip)
export function flipIn(el: Element | null, delay = 0): void {
  if (!el || reducedMotion()) return;
  gsap.fromTo(
    el,
    { rotationY: 90, opacity: 0 },
    { rotationY: 0, opacity: 1, duration: 0.55, delay, ease: 'back.out(1.6)', clearProps: 'transform,opacity' },
  );
}

// telepati eslesmesi: iki avatar birbirine sokulup birlikte ziplar
export function snuggle(left: Element | null, right: Element | null): void {
  if (!left || !right || reducedMotion()) return;
  const tl = gsap.timeline();
  tl.to(left, { x: 9, duration: 0.22, ease: 'power2.out' }, 0)
    .to(right, { x: -9, duration: 0.22, ease: 'power2.out' }, 0)
    .to([left, right], { y: -16, duration: 0.18, ease: 'power1.out' }, 0.22)
    .to([left, right], { y: 0, duration: 0.5, ease: 'bounce.out' }, 0.4)
    .to([left, right], { x: 0, duration: 0.3, ease: 'power2.inOut', clearProps: 'x,y' }, 1.25);
}

// yukari/asagi ok ziplamasi: dy yonunde itip yerine oturt
export function nudgeY(el: Element | null, dy: number): void {
  if (!el || reducedMotion()) return;
  gsap.fromTo(
    el,
    { y: dy },
    { y: 0, duration: 0.55, ease: 'bounce.out', clearProps: 'y' },
  );
}
