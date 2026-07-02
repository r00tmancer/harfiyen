// Saf oyun mantigi — veri dosyasi import etmez, sozluk/cift sayilari disaridan verilir.
import { JOKER_PER_ROUNDS, MIN_WORD_LEN, matchesPattern, normalizeTr } from '@harfiyen/shared';
import type { WordRejectReason } from '@harfiyen/shared';

// Buz jokeri: oyuncu until anina KADAR donuktur; tam sinirda (now === until) donuk DEGILDIR.
export function isFrozen(frozenUntil: Readonly<Record<string, number>>, pid: string, now: number): boolean {
  const until = frozenUntil[pid] ?? 0;
  return now < until;
}

// Yeni raund basladiginda iki oyuncuya da +1 joker dolar mi? (6, 11, 16, ...)
export function jokerGrantedOnRound(round: number): boolean {
  return round > 1 && round % JOKER_PER_ROUNDS === 1;
}

// Joker kullanma kosulu: hak var ve rakip su an zaten donuk degil.
export function canUseJoker(jokers: number, opponentFrozenNow: boolean): boolean {
  return jokers > 0 && !opponentFrozenNow;
}

export type WordVerdict =
  | { ok: true; word: string }
  | { ok: false; reason: WordRejectReason };

// Kelimeyi normalize edip sirasiyla uzunluk, desen, tekrar ve sozluk kontrolu yapar.
export function validateWord(
  raw: string,
  letters: readonly [string, string],
  used: ReadonlySet<string>,
  dict: ReadonlySet<string>,
): WordVerdict {
  const word = normalizeTr(raw);
  if (word.length < MIN_WORD_LEN) return { ok: false, reason: 'too_short' };
  if (!matchesPattern(word, letters[0], letters[1])) return { ok: false, reason: 'wrong_pattern' };
  if (used.has(word)) return { ok: false, reason: 'already_used' };
  if (!dict.has(word)) return { ok: false, reason: 'not_in_dict' };
  return { ok: true, word };
}

// En az minCount cozumu olan ciftlerden rastgele birini secer; uygun cift yoksa null.
export function chooseFallbackPair(
  pairs: Readonly<Record<string, number>>,
  minCount: number,
  rand: () => number,
): [string, string] | null {
  const eligible = Object.keys(pairs).filter((k) => (pairs[k] ?? 0) >= minCount);
  if (eligible.length === 0) return null;
  const idx = Math.min(eligible.length - 1, Math.max(0, Math.floor(rand() * eligible.length)));
  const chars = [...eligible[idx]];
  const a = chars[0] ?? 'a';
  return [a, chars[1] ?? a];
}

// Takma adi butun parcalar (token) halinde kufur listesine karsi kontrol eder.
export function isNickClean(nick: string, badwords: ReadonlySet<string>): boolean {
  const normalized = normalizeTr(nick);
  if (badwords.has(normalized)) return false;
  const tokens = normalized.split(/[^a-zçğıöşü]+/u).filter(Boolean);
  return tokens.every((t) => !badwords.has(t));
}

// words.txt icerigini izolat basina bir kez Set'e cevirir (global scope'ta AGIR parse yok).
let dictCache: { raw: string; set: Set<string> } | null = null;
export function loadDict(raw: string): Set<string> {
  if (dictCache && dictCache.raw === raw) return dictCache.set;
  const set = new Set<string>();
  for (const line of raw.split('\n')) {
    const w = line.trim();
    if (w) set.add(w);
  }
  dictCache = { raw, set };
  return set;
}

// Bilinmeyen bicimdeki kufur verisini normalize edilmis Set'e cevirir.
export function toWordSet(data: unknown): Set<string> {
  const out = new Set<string>();
  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as { words?: unknown }).words)) {
    arr = (data as { words: unknown[] }).words;
  }
  for (const w of arr) {
    if (typeof w === 'string') out.add(normalizeTr(w));
  }
  return out;
}

// pairs.json icerigini {ciftAnahtari: sayi} kaydina cevirir.
export function toPairCounts(data: unknown): Record<string, number> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const values = Object.values(obj);
    if (values.length > 0 && values.every((v) => typeof v === 'number')) {
      return obj as Record<string, number>;
    }
    if (obj.pairs && typeof obj.pairs === 'object') return toPairCounts(obj.pairs);
  }
  return {};
}
