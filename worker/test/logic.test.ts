// Saf oyun mantigi testleri — veri dosyalarina bagimlilik yok.
import { describe, expect, it } from 'vitest';
import { normalizeTr, pairKey } from '@harfiyen/shared';
import {
  canUseJoker,
  chooseFallbackPair,
  isFrozen,
  isNickClean,
  jokerGrantedOnRound,
  loadDict,
  toPairCounts,
  toWordSet,
  validateWord,
} from '../src/game/logic';

const dict = new Set(['ışık', 'kağıt', 'kalem', 'araba', 'kek', 'kitap', 'çiçek']);
const noUsed = new Set<string>();

describe('validateWord — Turkce normalizasyon', () => {
  it('IŞIK girisi tr-TR kucuk harfe iner ve sozlukteki ışık ile eslesir', () => {
    // plain toLowerCase 'I' icin 'i' verir, 'ı' vermez — bu yol calismazdi
    expect('IŞIK'.toLowerCase()).not.toBe('ışık');
    const r = validateWord('IŞIK', ['ı', 'k'], noUsed, dict);
    expect(r).toEqual({ ok: true, word: 'ışık' });
  });

  it('sapkali harf sadelesir: KÂĞIT -> kağıt', () => {
    expect(normalizeTr('kâğıt')).toBe('kağıt');
    const r = validateWord('KÂĞIT', ['k', 't'], noUsed, dict);
    expect(r).toEqual({ ok: true, word: 'kağıt' });
  });

  it('bosluklar kirpilir', () => {
    const r = validateWord('  kalem  ', ['k', 'm'], noUsed, dict);
    expect(r).toEqual({ ok: true, word: 'kalem' });
  });
});

describe('validateWord — desen', () => {
  it('duz yon: k...m', () => {
    expect(validateWord('kalem', ['k', 'm'], noUsed, dict)).toEqual({ ok: true, word: 'kalem' });
  });

  it('ters yon: m...k harfleriyle kalem gecerli', () => {
    expect(validateWord('kalem', ['m', 'k'], noUsed, dict)).toEqual({ ok: true, word: 'kalem' });
  });

  it('desene uymayan kelime wrong_pattern', () => {
    expect(validateWord('kalem', ['k', 'z'], noUsed, dict)).toEqual({ ok: false, reason: 'wrong_pattern' });
  });

  it('ayni harf cifti (a,a): araba gecerli', () => {
    expect(validateWord('araba', ['a', 'a'], noUsed, dict)).toEqual({ ok: true, word: 'araba' });
  });

  it('ayni harf cifti (a,a): kalem wrong_pattern', () => {
    expect(validateWord('kalem', ['a', 'a'], noUsed, dict)).toEqual({ ok: false, reason: 'wrong_pattern' });
  });
});

describe('validateWord — diger redler', () => {
  it('kullanilmis kelime already_used (normalize sonrasi eslesir)', () => {
    const used = new Set(['kalem']);
    expect(validateWord('KALEM', ['k', 'm'], used, dict)).toEqual({ ok: false, reason: 'already_used' });
  });

  it('kisa kelime too_short', () => {
    expect(validateWord('ak', ['a', 'k'], noUsed, dict)).toEqual({ ok: false, reason: 'too_short' });
  });

  it('too_short desenden once gelir', () => {
    expect(validateWord('zz', ['k', 'm'], noUsed, dict)).toEqual({ ok: false, reason: 'too_short' });
  });

  it('sozlukte olmayan kelime not_in_dict', () => {
    expect(validateWord('kem', ['k', 'm'], noUsed, dict)).toEqual({ ok: false, reason: 'not_in_dict' });
  });
});

describe('chooseFallbackPair', () => {
  it('minCount altindaki ciftleri asla secmez', () => {
    const pairs = { ab: 1, ak: 5, mz: 2 };
    for (const r of [0, 0.3, 0.7, 0.999]) {
      expect(chooseFallbackPair(pairs, 3, () => r)).toEqual(['a', 'k']);
    }
  });

  it('uygun cift yoksa null doner', () => {
    expect(chooseFallbackPair({ ab: 1, cd: 2 }, 3, () => 0.5)).toBeNull();
  });

  it('rand ile deterministik secim yapar', () => {
    const pairs = { ab: 5, cd: 7, ef: 9 };
    expect(chooseFallbackPair(pairs, 3, () => 0)).toEqual(['a', 'b']);
    expect(chooseFallbackPair(pairs, 3, () => 0.99)).toEqual(['e', 'f']);
  });

  it('ayni harfli cift anahtarini iki harfe ayirir', () => {
    expect(chooseFallbackPair({ [pairKey('a', 'a')]: 10 }, 3, () => 0)).toEqual(['a', 'a']);
  });
});

describe('isNickClean', () => {
  const bad = new Set(['yasak', 'kufur']);

  it('birebir kufur reddedilir (buyuk harf dahil)', () => {
    expect(isNickClean('yasak', bad)).toBe(false);
    expect(isNickClean('YASAK', bad)).toBe(false);
  });

  it('rakam/ayrac icindeki butun token yakalanir', () => {
    expect(isNickClean('Yasak99', bad)).toBe(false);
    expect(isNickClean('kufur_baba', bad)).toBe(false);
  });

  it('alt dizgi degil butun token kontrolu: yasakli temizdir', () => {
    expect(isNickClean('yasakli', bad)).toBe(true);
    expect(isNickClean('iyi oyuncu', bad)).toBe(true);
  });
});

describe('loadDict', () => {
  it('satirlari kirpar, bosluklari atlar ve cache doner', () => {
    const raw = 'kalem\r\nkitap\n\n  araba  \n';
    const set = loadDict(raw);
    expect(set.has('kalem')).toBe(true);
    expect(set.has('kitap')).toBe(true);
    expect(set.has('araba')).toBe(true);
    expect(set.size).toBe(3);
    expect(loadDict(raw)).toBe(set); // ayni girdi ayni Set (izolat cache)
  });
});

describe('isFrozen — buz jokeri sinir durumlari', () => {
  it('until aninin oncesinde donuktur', () => {
    expect(isFrozen({ p1: 1000 }, 'p1', 999)).toBe(true);
  });

  it('tam sinirda (now === until) donuk DEGILDIR', () => {
    expect(isFrozen({ p1: 1000 }, 'p1', 1000)).toBe(false);
  });

  it('until sonrasinda donuk degildir', () => {
    expect(isFrozen({ p1: 1000 }, 'p1', 1001)).toBe(false);
  });

  it('kaydi olmayan oyuncu donuk degildir', () => {
    expect(isFrozen({}, 'p1', 0)).toBe(false);
    expect(isFrozen({ p2: 5000 }, 'p1', 100)).toBe(false);
  });
});

describe('jokerGrantedOnRound — 5 raundluk blok matematigi', () => {
  it('1. raundda ek joker dolmaz (baslangic hakki katilimda verilir)', () => {
    expect(jokerGrantedOnRound(1)).toBe(false);
  });

  it('5. ve 10. raundda dolmaz', () => {
    expect(jokerGrantedOnRound(5)).toBe(false);
    expect(jokerGrantedOnRound(10)).toBe(false);
  });

  it('6. ve 11. raundda dolar', () => {
    expect(jokerGrantedOnRound(6)).toBe(true);
    expect(jokerGrantedOnRound(11)).toBe(true);
  });
});

describe('canUseJoker', () => {
  it('hak yoksa reddedilir', () => {
    expect(canUseJoker(0, false)).toBe(false);
  });

  it('rakip zaten donuksa reddedilir', () => {
    expect(canUseJoker(1, true)).toBe(false);
  });

  it('hak var ve rakip donuk degilse kullanilabilir', () => {
    expect(canUseJoker(1, false)).toBe(true);
  });
});

describe('veri donusturuculer', () => {
  it('toWordSet dizi ve {words} bicimlerini normalize eder', () => {
    expect(toWordSet(['AptaL', 'salak']).has('aptal')).toBe(true);
    expect(toWordSet({ words: ['kufur'] }).has('kufur')).toBe(true);
    expect(toWordSet(42).size).toBe(0);
  });

  it('toPairCounts duz kaydi ve ic ice pairs alanini kabul eder', () => {
    expect(toPairCounts({ ak: 5 })).toEqual({ ak: 5 });
    expect(toPairCounts({ pairs: { ak: 5 } })).toEqual({ ak: 5 });
    expect(toPairCounts([1, 2])).toEqual({});
  });
});
