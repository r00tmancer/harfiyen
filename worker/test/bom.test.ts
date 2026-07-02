// 7 Bom saf karar mantigi testleri — veri dosyasina bagimlilik yok.
import { describe, expect, it } from 'vitest';
import { BOM_DECAY_MS, BOM_MIN_MS, BOM_START_MS, isBom } from '@harfiyen/shared';
import { bomPress, decayBomMs } from '../src/game/logic';

describe('isBom — 7 Bom tablosu', () => {
  const bomNumbers = [7, 14, 17, 27, 70, 71, 21, 49]; // 7'nin kati VEYA icinde 7
  const plainNumbers = [1, 8, 10, 22]; // ne kat ne de 7 icerir

  it('BOM sayilari true doner', () => {
    for (const n of bomNumbers) expect(isBom(n)).toBe(true);
  });
  it('duz sayilar false doner', () => {
    for (const n of plainNumbers) expect(isBom(n)).toBe(false);
  });
});

describe('bomPress — dogruluk (kind === bom, isBom eslesmesi)', () => {
  const bomNumbers = [7, 14, 17, 27, 70, 71, 21, 49];
  const plainNumbers = [1, 8, 10, 22];

  it('BOM sayilarinda "bom" dogru, "number" yanlis', () => {
    for (const n of bomNumbers) {
      expect(bomPress({ current: n, kind: 'bom', insured: false, lives: 3, turnMs: BOM_START_MS }).ok).toBe(true);
      expect(bomPress({ current: n, kind: 'number', insured: false, lives: 3, turnMs: BOM_START_MS }).ok).toBe(false);
    }
  });
  it('duz sayilarda "number" dogru, "bom" yanlis', () => {
    for (const n of plainNumbers) {
      expect(bomPress({ current: n, kind: 'number', insured: false, lives: 3, turnMs: BOM_START_MS }).ok).toBe(true);
      expect(bomPress({ current: n, kind: 'bom', insured: false, lives: 3, turnMs: BOM_START_MS }).ok).toBe(false);
    }
  });
  it('timeout her zaman yanlistir (isBom fark etmez)', () => {
    expect(bomPress({ current: 7, kind: 'timeout', insured: false, lives: 3, turnMs: BOM_START_MS }).ok).toBe(false);
    expect(bomPress({ current: 8, kind: 'timeout', insured: false, lives: 3, turnMs: BOM_START_MS }).ok).toBe(false);
  });
});

describe('bomPress — dogru hamle ilerlemesi', () => {
  it('sayi +1 ilerler, sure decay olur, can gitmez', () => {
    // current=6 duz sayi -> "number" dogru
    expect(bomPress({ current: 6, kind: 'number', insured: false, lives: 3, turnMs: BOM_START_MS })).toEqual({
      ok: true,
      insuredUsed: false,
      lifeLost: false,
      next: 7,
      turnMs: BOM_START_MS - BOM_DECAY_MS,
      livesAfter: 3,
      matchEnd: false,
    });
  });
  it('sure tabana inince decay orada kalir', () => {
    expect(bomPress({ current: 6, kind: 'number', insured: false, lives: 3, turnMs: BOM_MIN_MS }).turnMs).toBe(BOM_MIN_MS);
  });
});

describe('decayBomMs — sure kisalmasi ve taban', () => {
  it('her sayida BOM_DECAY_MS kadar kisalir', () => {
    expect(decayBomMs(BOM_START_MS)).toBe(BOM_START_MS - BOM_DECAY_MS);
  });
  it('tabana BOM_MIN_MS inmez', () => {
    expect(decayBomMs(BOM_MIN_MS)).toBe(BOM_MIN_MS);
    expect(decayBomMs(BOM_MIN_MS + 100)).toBe(BOM_MIN_MS); // 100 < DECAY
  });
});

describe('bomPress — sigorta tuketimi', () => {
  it('sigortaliyken yanlis: hata affedilir, can gitmez, sayi ilerlemez, sure sifirlanir', () => {
    // current=5 duz sayi, "bom" basmak yanlis
    expect(bomPress({ current: 5, kind: 'bom', insured: true, lives: 2, turnMs: BOM_MIN_MS })).toEqual({
      ok: false,
      insuredUsed: true,
      lifeLost: false,
      next: 5,
      turnMs: BOM_START_MS,
      livesAfter: 2,
      matchEnd: false,
    });
  });
  it('timeout da sigortayla affedilir', () => {
    const o = bomPress({ current: 5, kind: 'timeout', insured: true, lives: 1, turnMs: BOM_MIN_MS });
    expect(o.insuredUsed).toBe(true);
    expect(o.lifeLost).toBe(false);
    expect(o.livesAfter).toBe(1);
    expect(o.matchEnd).toBe(false);
  });
  it('sigorta dogru hamlede tuketilmez', () => {
    const o = bomPress({ current: 6, kind: 'number', insured: true, lives: 2, turnMs: BOM_START_MS });
    expect(o.ok).toBe(true);
    expect(o.insuredUsed).toBe(false);
  });
});

describe('bomPress — can kaybi ve mac sonu', () => {
  it('sigortasiz yanlis: can gider, sayi ilerlemez, sure sifirlanir', () => {
    // current=9 duz sayi, "bom" yanlis
    expect(bomPress({ current: 9, kind: 'bom', insured: false, lives: 3, turnMs: BOM_MIN_MS })).toEqual({
      ok: false,
      insuredUsed: false,
      lifeLost: true,
      next: 9,
      turnMs: BOM_START_MS,
      livesAfter: 2,
      matchEnd: false,
    });
  });
  it('son can giderse mac biter (matchEnd)', () => {
    const o = bomPress({ current: 3, kind: 'bom', insured: false, lives: 1, turnMs: BOM_START_MS });
    expect(o.lifeLost).toBe(true);
    expect(o.livesAfter).toBe(0);
    expect(o.matchEnd).toBe(true);
  });
  it('timeout sigortasiz can goturur, sayi ayni kalir', () => {
    const o = bomPress({ current: 4, kind: 'timeout', insured: false, lives: 2, turnMs: BOM_START_MS });
    expect(o.ok).toBe(false);
    expect(o.lifeLost).toBe(true);
    expect(o.next).toBe(4);
    expect(o.livesAfter).toBe(1);
  });
});
