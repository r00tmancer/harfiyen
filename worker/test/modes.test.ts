// Yeni modlarin saf mantik testleri (sayi/zincir/uzun) — veri dosyasina bagimlilik yok.
import { describe, expect, it } from 'vitest';
import {
  SAYI_BAND_ILIK,
  SAYI_BAND_KAYNIYOR,
  SAYI_BAND_SICAK,
  ZINCIR_DECAY_MS,
  ZINCIR_MIN_MS,
  ZINCIR_START_MS,
} from '@harfiyen/shared';
import {
  decayTurnMs,
  eligibleStartLetters,
  loadStartCounts,
  nextRequiredLetter,
  sayiBand,
  sayiCompare,
  sayiRoundDecision,
  updateBounds,
  uzunWinner,
  validateZincir,
} from '../src/game/logic';

describe('sayiCompare — yon', () => {
  it('tahmin < gizli ise yukari (daha yukari cik)', () => {
    expect(sayiCompare(30, 50)).toBe('yukari');
  });
  it('tahmin > gizli ise asagi', () => {
    expect(sayiCompare(70, 50)).toBe('asagi');
  });
  it('esitse buldu', () => {
    expect(sayiCompare(50, 50)).toBe('buldu');
  });
});

describe('sayiBand — termometre mesafe bantlari', () => {
  it('tam isabet buldu', () => {
    expect(sayiBand(42, 42)).toBe('buldu');
  });
  it('KAYNIYOR sinirinda kayniyor, bir otesi sicak', () => {
    expect(sayiBand(50 + SAYI_BAND_KAYNIYOR, 50)).toBe('kayniyor');
    expect(sayiBand(50 + SAYI_BAND_KAYNIYOR + 1, 50)).toBe('sicak');
  });
  it('SICAK sinirinda sicak, bir otesi ilik', () => {
    expect(sayiBand(50 + SAYI_BAND_SICAK, 50)).toBe('sicak');
    expect(sayiBand(50 + SAYI_BAND_SICAK + 1, 50)).toBe('ilik');
  });
  it('ILIK sinirinda ilik, bir otesi soguk', () => {
    expect(sayiBand(50 + SAYI_BAND_ILIK, 50)).toBe('ilik');
    expect(sayiBand(50 + SAYI_BAND_ILIK + 1, 50)).toBe('soguk');
  });
  it('mesafe simetriktir (asagi yon)', () => {
    expect(sayiBand(50 - SAYI_BAND_KAYNIYOR, 50)).toBe('kayniyor');
  });
});

describe('updateBounds — aralik daraltma (lo < x < hi)', () => {
  it('yukari: lo yukselir, hi degismez', () => {
    expect(updateBounds({ lo: 0, hi: 101 }, 30, 'yukari')).toEqual({ lo: 30, hi: 101 });
  });
  it('asagi: hi duser, lo degismez', () => {
    expect(updateBounds({ lo: 0, hi: 101 }, 70, 'asagi')).toEqual({ lo: 0, hi: 70 });
  });
  it('daha zayif bilgi araligi genisletmez', () => {
    expect(updateBounds({ lo: 40, hi: 60 }, 20, 'yukari')).toEqual({ lo: 40, hi: 60 });
    expect(updateBounds({ lo: 40, hi: 60 }, 80, 'asagi')).toEqual({ lo: 40, hi: 60 });
  });
});

describe('sayiRoundDecision — eşitleme adaleti', () => {
  it('bulamayan tahmin: raund devam eder', () => {
    expect(sayiRoundDecision({ found: false, guesserIsStarter: true, inEqualizer: false })).toEqual({
      equalizer: false,
      over: false,
      result: null,
    });
  });
  it('baslatici bulursa eşitleme baslar (raund bitmez)', () => {
    expect(sayiRoundDecision({ found: true, guesserIsStarter: true, inEqualizer: false })).toEqual({
      equalizer: true,
      over: false,
      result: null,
    });
  });
  it('baslatici-olmayan bulursa hemen o kazanir', () => {
    expect(sayiRoundDecision({ found: true, guesserIsStarter: false, inEqualizer: false })).toEqual({
      equalizer: false,
      over: true,
      result: 'guesser',
    });
  });
  it('eşitlemede rakip de bulursa berabere', () => {
    expect(sayiRoundDecision({ found: true, guesserIsStarter: false, inEqualizer: true })).toEqual({
      equalizer: false,
      over: true,
      result: 'tie',
    });
  });
  it('eşitlemede rakip bulamazsa baslatici kazanir', () => {
    expect(sayiRoundDecision({ found: false, guesserIsStarter: false, inEqualizer: true })).toEqual({
      equalizer: false,
      over: true,
      result: 'starter',
    });
  });
});

describe('decayTurnMs — sure kisalmasi ve taban', () => {
  it('her kelimede ZINCIR_DECAY_MS kadar kisalir', () => {
    expect(decayTurnMs(ZINCIR_START_MS)).toBe(ZINCIR_START_MS - ZINCIR_DECAY_MS);
  });
  it('tabana ZINCIR_MIN_MS inmez', () => {
    expect(decayTurnMs(ZINCIR_MIN_MS)).toBe(ZINCIR_MIN_MS);
    expect(decayTurnMs(ZINCIR_MIN_MS + 100)).toBe(ZINCIR_MIN_MS); // 100 < DECAY
  });
});

describe('nextRequiredLetter — geriye tarama fallback', () => {
  const hasStart = (l: string): boolean => l !== 'ğ'; // 'ğ' ile baslayan kelime yok
  it('son harf uygunsa onu doner', () => {
    expect(nextRequiredLetter('kalem', hasStart)).toBe('m');
  });
  it("'ğ' ile biterse geriye taranir (dağ -> a)", () => {
    expect(nextRequiredLetter('dağ', hasStart)).toBe('a');
  });
  it('birden fazla uygunsuz harf geriye atlanir', () => {
    // 'ağ' -> son 'ğ' atlanir, 'a' uygun
    expect(nextRequiredLetter('ağ', hasStart)).toBe('a');
  });
  it('hicbiri uygun degilse son harfe duser', () => {
    expect(nextRequiredLetter('ğ', hasStart)).toBe('ğ');
  });
});

describe('uzunWinner — kazanan secimi', () => {
  it('en uzun gecerli kelime kazanir', () => {
    expect(uzunWinner({ a: { word: 'kek', len: 3, at: 10 }, b: { word: 'kalem', len: 5, at: 20 } })).toBe('b');
  });
  it('uzunluk esitse en erken gonderen kazanir', () => {
    expect(uzunWinner({ a: { word: 'kalem', len: 5, at: 30 }, b: { word: 'kitap', len: 5, at: 20 } })).toBe('b');
  });
  it('bir taraf null ise diger taraf kazanir', () => {
    expect(uzunWinner({ a: null, b: { word: 'kek', len: 3, at: 5 } })).toBe('b');
  });
  it('ikisi de null ise kazanan yok', () => {
    expect(uzunWinner({ a: null, b: null })).toBeNull();
  });
});

describe('validateZincir — bas harf zorunlulugu', () => {
  const dict = new Set(['kalem', 'kitap', 'masa']);
  it('dogru bas harf ve sozlukte -> kabul', () => {
    expect(validateZincir('kalem', 'k', new Set(), dict)).toEqual({ ok: true, word: 'kalem' });
  });
  it('yanlis bas harf -> wrong_pattern', () => {
    expect(validateZincir('masa', 'k', new Set(), dict)).toEqual({ ok: false, reason: 'wrong_pattern' });
  });
  it('kullanilmis -> already_used', () => {
    expect(validateZincir('kalem', 'k', new Set(['kalem']), dict)).toEqual({ ok: false, reason: 'already_used' });
  });
  it('sozlukte yok -> not_in_dict', () => {
    expect(validateZincir('kabak', 'k', new Set(), dict)).toEqual({ ok: false, reason: 'not_in_dict' });
  });
  it('kisa -> too_short (bas harf kontrolunden once)', () => {
    expect(validateZincir('ke', 'k', new Set(), dict)).toEqual({ ok: false, reason: 'too_short' });
  });
});

describe('loadStartCounts + eligibleStartLetters', () => {
  it('bas harfleri sayar', () => {
    const counts = loadStartCounts('kalem\nkitap\nmasa\nışık\n');
    expect(counts.get('k')).toBe(2);
    expect(counts.get('m')).toBe(1);
    expect(counts.get('ı')).toBe(1);
  });
  it('esik ustundeki harfleri suzer', () => {
    const counts = loadStartCounts('kalem\nkitap\nmasa\n');
    expect(eligibleStartLetters(counts, 2).sort()).toEqual(['k']);
    expect(eligibleStartLetters(counts, 1).sort()).toEqual(['k', 'm']);
  });
});
