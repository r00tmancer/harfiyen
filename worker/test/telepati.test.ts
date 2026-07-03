// Telepati modunun saf mantik testleri: kim-tipi pid cozumu, ab eslesmesi,
// cifte kalp puanlamasi, cevapsiz durum ve rastgele soru alt kumesi benzersizligi.
import { describe, expect, it } from 'vitest';
import { TELEPATI_QUESTIONS } from '@harfiyen/shared';
import {
  isValidChoice,
  pickQuestions,
  resolveKimTarget,
  telepatiDelta,
  telepatiEvaluate,
  toTelepatiBank,
} from '../src/game/modes/telepati';
import bankJson from '../src/data/telepati.json';

const PIDS: readonly [string, string] = ['p1', 'p2'];

describe('resolveKimTarget — ben/o hedef cozumu', () => {
  it("'ben' cevaplayanin kendisini gosterir", () => {
    expect(resolveKimTarget('ben', 'p1', 'p2')).toBe('p1');
  });
  it("'o' rakibi gosterir", () => {
    expect(resolveKimTarget('o', 'p1', 'p2')).toBe('p2');
  });
});

describe('telepatiEvaluate — kim tipi eslesme matrisi', () => {
  it('ikisi de BEN derse farkli kisileri gosterirler -> ESLESMEZ', () => {
    const v = telepatiEvaluate('kim', { p1: 'ben', p2: 'ben' }, PIDS);
    expect(v.match).toBe(false);
    expect(v.answers).toEqual({ p1: 'p1', p2: 'p2' });
  });
  it("p1 'ben' + p2 'o' ikisi de p1'i gosterir -> ESLESIR", () => {
    const v = telepatiEvaluate('kim', { p1: 'ben', p2: 'o' }, PIDS);
    expect(v.match).toBe(true);
    expect(v.answers).toEqual({ p1: 'p1', p2: 'p1' });
  });
  it("p1 'o' + p2 'ben' ikisi de p2'yi gosterir -> ESLESIR", () => {
    const v = telepatiEvaluate('kim', { p1: 'o', p2: 'ben' }, PIDS);
    expect(v.match).toBe(true);
    expect(v.answers).toEqual({ p1: 'p2', p2: 'p2' });
  });
  it('ikisi de O derse birbirlerini gosterirler -> ESLESMEZ', () => {
    const v = telepatiEvaluate('kim', { p1: 'o', p2: 'o' }, PIDS);
    expect(v.match).toBe(false);
    expect(v.answers).toEqual({ p1: 'p2', p2: 'p1' });
  });
});

describe('telepatiEvaluate — ab tipi', () => {
  it('ayni sik -> eslesir, cevaplar oldugu gibi acilir', () => {
    const v = telepatiEvaluate('ab', { p1: 'a', p2: 'a' }, PIDS);
    expect(v.match).toBe(true);
    expect(v.answers).toEqual({ p1: 'a', p2: 'a' });
  });
  it('farkli sik -> eslesmez', () => {
    expect(telepatiEvaluate('ab', { p1: 'a', p2: 'b' }, PIDS).match).toBe(false);
  });
});

describe('telepatiEvaluate — cevapsiz oyuncu', () => {
  it('tek taraf cevapladi: eslesme yok, cevapsizin anahtari haritada YOK', () => {
    const v = telepatiEvaluate('ab', { p1: 'a' }, PIDS);
    expect(v.match).toBe(false);
    expect(v.answers).toEqual({ p1: 'a' });
    expect('p2' in v.answers).toBe(false);
  });
  it('kim tipinde de cevapsiz anahtar dusmez', () => {
    const v = telepatiEvaluate('kim', { p2: 'o' }, PIDS);
    expect(v.match).toBe(false);
    expect(v.answers).toEqual({ p2: 'p1' });
  });
  it('kimse cevaplamadi: bos harita, eslesme yok', () => {
    const v = telepatiEvaluate('ab', {}, PIDS);
    expect(v.match).toBe(false);
    expect(v.answers).toEqual({});
  });
});

describe('telepatiDelta — cifte kalp puanlamasi', () => {
  it('eslesme normalde 1 puan', () => {
    expect(telepatiDelta(true, false)).toBe(1);
  });
  it('cifte kalpli eslesme 2 puan', () => {
    expect(telepatiDelta(true, true)).toBe(2);
  });
  it('eslesmeyen soru cifte kalpli bile olsa 0', () => {
    expect(telepatiDelta(false, true)).toBe(0);
    expect(telepatiDelta(false, false)).toBe(0);
  });
});

describe('isValidChoice — secim/soru tipi uyumu', () => {
  it("ab sadece 'a'/'b' kabul eder", () => {
    expect(isValidChoice('ab', 'a')).toBe(true);
    expect(isValidChoice('ab', 'b')).toBe(true);
    expect(isValidChoice('ab', 'ben')).toBe(false);
    expect(isValidChoice('ab', 'x')).toBe(false);
  });
  it("kim sadece 'ben'/'o' kabul eder", () => {
    expect(isValidChoice('kim', 'ben')).toBe(true);
    expect(isValidChoice('kim', 'o')).toBe(true);
    expect(isValidChoice('kim', 'a')).toBe(false);
  });
});

describe('pickQuestions — rastgele BENZERSIZ alt kume', () => {
  const bank = Array.from({ length: 150 }, (_, i) => i);

  it('istenen sayida benzersiz eleman doner', () => {
    const picked = pickQuestions(bank, TELEPATI_QUESTIONS, Math.random);
    expect(picked).toHaveLength(TELEPATI_QUESTIONS);
    expect(new Set(picked).size).toBe(TELEPATI_QUESTIONS);
    for (const q of picked) expect(bank).toContain(q);
  });
  it('rand sinir degerlerinde bile tekrar uretmez', () => {
    for (const r of [() => 0, () => 0.999999999]) {
      const picked = pickQuestions(bank, TELEPATI_QUESTIONS, r);
      expect(new Set(picked).size).toBe(TELEPATI_QUESTIONS);
    }
  });
  it('count bankadan buyukse tum banka (benzersiz) doner', () => {
    const small = [1, 2, 3];
    const picked = pickQuestions(small, 10, Math.random);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });
  it('farkli rand kaynaklari farkli alt kume verebilir (rovans tazeligi)', () => {
    const a = pickQuestions(bank, TELEPATI_QUESTIONS, () => 0);
    const b = pickQuestions(bank, TELEPATI_QUESTIONS, () => 0.5);
    expect(a).not.toEqual(b);
  });
});

describe('toTelepatiBank — json dogrulama', () => {
  it('gecerli kayitlari tipiyle ayristirir', () => {
    const bank = toTelepatiBank([
      { type: 'kim', q: 'Hangimiz daha inatci?' },
      { type: 'ab', q: 'Kahve mi cay mi?', a: 'Kahve', b: 'Cay' },
    ]);
    expect(bank).toEqual([
      { type: 'kim', q: 'Hangimiz daha inatci?' },
      { type: 'ab', q: 'Kahve mi cay mi?', a: 'Kahve', b: 'Cay' },
    ]);
  });
  it('bozuk kayitlar atlanir', () => {
    const bank = toTelepatiBank([
      { type: 'ab', q: 'siksiz' }, // a/b yok
      { type: 'kim' }, // q yok
      { type: 'baska', q: 'x' }, // bilinmeyen tip
      'metin',
      null,
    ]);
    expect(bank).toEqual([]);
  });
  it('dizi olmayan veri bos banka verir', () => {
    expect(toTelepatiBank({ foo: 1 })).toEqual([]);
    expect(toTelepatiBank(undefined)).toEqual([]);
  });
  it('gercek soru bankasi eksiksiz ayristirilir ve mac icin yeterlidir', () => {
    const bank = toTelepatiBank(bankJson);
    expect(bank.length).toBe(150);
    expect(bank.length).toBeGreaterThanOrEqual(TELEPATI_QUESTIONS);
    for (const q of bank) {
      expect(q.q.length).toBeGreaterThan(0);
      if (q.type === 'ab') {
        expect(typeof q.a).toBe('string');
        expect(typeof q.b).toBe('string');
      }
    }
  });
});
