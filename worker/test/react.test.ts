// Tepki (sticker) dogrulama + throttle saf mantik testleri.
import { describe, expect, it } from 'vitest';
import { REACTION_COUNT, REACTION_THROTTLE_MS } from '@harfiyen/shared';
import { canReact } from '../src/game/logic';

const NOW = 1_000_000;

describe('canReact — id dogrulama', () => {
  it('gecerli aralik 0..REACTION_COUNT-1 kabul, disi red', () => {
    expect(canReact(0, 0, NOW)).toBe(true);
    expect(canReact(REACTION_COUNT - 1, 0, NOW)).toBe(true);
    expect(canReact(-1, 0, NOW)).toBe(false);
    expect(canReact(REACTION_COUNT, 0, NOW)).toBe(false);
  });

  it('tamsayi olmayan / sayi olmayan id red (JSON her sey tasiyabilir)', () => {
    expect(canReact(1.5, 0, NOW)).toBe(false);
    expect(canReact(NaN, 0, NOW)).toBe(false);
    expect(canReact('2', 0, NOW)).toBe(false);
    expect(canReact(null, 0, NOW)).toBe(false);
    expect(canReact(undefined, 0, NOW)).toBe(false);
  });
});

describe('canReact — throttle', () => {
  it('son tepkiden throttle suresi gecmeden red, tam sinirda ve sonrasinda kabul', () => {
    const last = NOW - 1;
    expect(canReact(0, last, NOW)).toBe(false); // hemen ardindan
    expect(canReact(0, NOW - REACTION_THROTTLE_MS + 1, NOW)).toBe(false); // 1ms erken
    expect(canReact(0, NOW - REACTION_THROTTLE_MS, NOW)).toBe(true); // tam sinir
    expect(canReact(0, NOW - REACTION_THROTTLE_MS - 1, NOW)).toBe(true);
    expect(canReact(0, 0, NOW)).toBe(true); // hic tepki vermemis (lastReactAt=0)
  });
});
