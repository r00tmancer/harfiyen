// Saf oyun mantigi — veri dosyasi import etmez, sozluk/cift sayilari disaridan verilir.
import {
  BOM_DECAY_MS,
  BOM_MIN_MS,
  BOM_START_MS,
  JOKER_PER_ROUNDS,
  MIN_WORD_LEN,
  REACTION_COUNT,
  REACTION_THROTTLE_MS,
  SAYI_BAND_ILIK,
  SAYI_BAND_KAYNIYOR,
  SAYI_BAND_SICAK,
  ZINCIR_DECAY_MS,
  ZINCIR_MIN_MS,
  isBom,
  matchesPattern,
  normalizeTr,
} from '@harfiyen/shared';
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

// Tepki (sticker): id 0..REACTION_COUNT-1 tamsayi olmali ve oyuncunun son tepkisinden
// REACTION_THROTTLE_MS gecmis olmali. Tam sinirda (now - last === throttle) izin verilir.
export function canReact(id: unknown, lastReactAt: number, now: number): boolean {
  if (typeof id !== 'number' || !Number.isInteger(id)) return false;
  if (id < 0 || id >= REACTION_COUNT) return false;
  return now - lastReactAt >= REACTION_THROTTLE_MS;
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

// Kelime Zinciri: kelime tam olarak requiredLetter ile baslamali. Redler harf modundakileri yeniden kullanir.
export function validateZincir(
  raw: string,
  requiredLetter: string,
  used: ReadonlySet<string>,
  dict: ReadonlySet<string>,
): WordVerdict {
  const word = normalizeTr(raw);
  if (word.length < MIN_WORD_LEN) return { ok: false, reason: 'too_short' };
  if (word[0] !== requiredLetter) return { ok: false, reason: 'wrong_pattern' }; // yanlis bas harfi
  if (used.has(word)) return { ok: false, reason: 'already_used' };
  if (!dict.has(word)) return { ok: false, reason: 'not_in_dict' };
  return { ok: true, word };
}

// ---- Sayi Avi saf mantigi ----
export type SayiDir = 'yukari' | 'asagi' | 'buldu';

// value < secret -> 'yukari' (daha yukari cik), value > secret -> 'asagi', esit -> 'buldu'.
export function sayiCompare(value: number, secret: number): SayiDir {
  if (value === secret) return 'buldu';
  return value < secret ? 'yukari' : 'asagi';
}

export type SayiBand = 'buldu' | 'kayniyor' | 'sicak' | 'ilik' | 'soguk';

// Termometre jokeri: yon yerine mesafe bandi. Tam isabet yine 'buldu'.
export function sayiBand(value: number, secret: number): SayiBand {
  const diff = Math.abs(value - secret);
  if (diff === 0) return 'buldu';
  if (diff <= SAYI_BAND_KAYNIYOR) return 'kayniyor';
  if (diff <= SAYI_BAND_SICAK) return 'sicak';
  if (diff <= SAYI_BAND_ILIK) return 'ilik';
  return 'soguk';
}

export interface Bounds {
  lo: number;
  hi: number;
}

// 'yukari' -> lo yukselir; 'asagi' -> hi duser. Aralik lo < x < hi anlamindadir.
export function updateBounds(bounds: Bounds, value: number, dir: 'yukari' | 'asagi'): Bounds {
  if (dir === 'yukari') return { lo: Math.max(bounds.lo, value), hi: bounds.hi };
  return { lo: bounds.lo, hi: Math.min(bounds.hi, value) };
}

export interface SayiDecision {
  equalizer: boolean; // baslatici buldu -> rakibe tek eşitleme tahmini
  over: boolean; // raund bitti mi
  result: 'guesser' | 'starter' | 'tie' | null; // kazanan rolu (null: devam)
}

// Adalet kurali:
// - Eşitleme asamasindaysak: bulursa berabere (tie), bulamazsa baslatici (starter) kazanir.
// - Normalde: bulamadiysa devam. Baslatici bulduysa eşitleme baslar. Baslatici-olmayan bulduysa hemen o kazanir.
export function sayiRoundDecision(opts: {
  found: boolean;
  guesserIsStarter: boolean;
  inEqualizer: boolean;
}): SayiDecision {
  if (opts.inEqualizer) {
    return opts.found
      ? { equalizer: false, over: true, result: 'tie' }
      : { equalizer: false, over: true, result: 'starter' };
  }
  if (!opts.found) return { equalizer: false, over: false, result: null };
  if (opts.guesserIsStarter) return { equalizer: true, over: false, result: null };
  return { equalizer: false, over: true, result: 'guesser' };
}

// ---- Kelime Zinciri saf mantigi ----

// Her basarili kelimede tur suresi kisalir ama tabana (ZINCIR_MIN_MS) inmez.
export function decayTurnMs(current: number): number {
  return Math.max(ZINCIR_MIN_MS, current - ZINCIR_DECAY_MS);
}

// Sonraki bas harfi: kelimenin son harfi. Ama o harfle baslayan sozluk kelimesi yoksa
// (hasStart false, or. 'ğ') harfler geriye dogru taranir, ilk uygun harf secilir.
export function nextRequiredLetter(word: string, hasStart: (letter: string) => boolean): string {
  const chars = [...word];
  for (let i = chars.length - 1; i >= 0; i--) {
    if (hasStart(chars[i])) return chars[i];
  }
  return chars[chars.length - 1] ?? word;
}

// ---- 7 Bom saf mantigi ----

// Her sayida tur suresi kisalir ama tabana (BOM_MIN_MS) inmez.
export function decayBomMs(current: number): number {
  return Math.max(BOM_MIN_MS, current - BOM_DECAY_MS);
}

export interface BomOutcome {
  ok: boolean; // dogru hamle miydi
  insuredUsed: boolean; // hata sigortayla mi affedildi
  lifeLost: boolean; // can gitti mi
  next: number; // siradaki sayi (dogruysa +1, degilse degismez)
  turnMs: number; // yeni tur suresi (dogruysa decay, degilse tabana/basa sifirlanir)
  livesAfter: number; // hamleyi yapanin kalan cani
  matchEnd: boolean; // can 0'a dustu mu
}

// Bir basisin (veya sure dolmasinin) sonucu. kind 'timeout' her zaman yanlistir.
// Dogru: (kind==='bom') === isBom(current). Yanlista once sigorta, yoksa can gider.
export function bomPress(opts: {
  current: number;
  kind: 'number' | 'bom' | 'timeout';
  insured: boolean; // hamleyi yapan sigortali mi
  lives: number; // hamleyi yapanin mevcut cani
  turnMs: number; // mevcut tur suresi
}): BomOutcome {
  const correct = opts.kind !== 'timeout' && (opts.kind === 'bom') === isBom(opts.current);
  if (correct) {
    return {
      ok: true,
      insuredUsed: false,
      lifeLost: false,
      next: opts.current + 1,
      turnMs: decayBomMs(opts.turnMs),
      livesAfter: opts.lives,
      matchEnd: false,
    };
  }
  // Yanlis (veya sure doldu): once sigorta affeder, sayi ilerlemez, sure basa doner.
  if (opts.insured) {
    return {
      ok: false,
      insuredUsed: true,
      lifeLost: false,
      next: opts.current,
      turnMs: BOM_START_MS,
      livesAfter: opts.lives,
      matchEnd: false,
    };
  }
  const livesAfter = Math.max(0, opts.lives - 1);
  return {
    ok: false,
    insuredUsed: false,
    lifeLost: true,
    next: opts.current,
    turnMs: BOM_START_MS,
    livesAfter,
    matchEnd: livesAfter <= 0,
  };
}

// ---- En Uzun Kelime saf mantigi ----
export interface UzunEntry {
  word: string;
  len: number;
  at: number; // kabul zaman damgasi (esitlikte erken olan kazanir)
}

// En uzun gecerli kelime kazanir; uzunluk esitse en erken gonderen; ikisi de null ise kazanan yok.
export function uzunWinner(entries: Readonly<Record<string, UzunEntry | null>>): string | null {
  let best: { pid: string; len: number; at: number } | null = null;
  for (const [pid, e] of Object.entries(entries)) {
    if (!e) continue;
    if (best === null || e.len > best.len || (e.len === best.len && e.at < best.at)) {
      best = { pid, len: e.len, at: e.at };
    }
  }
  return best?.pid ?? null;
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

// words.txt'teki her harfin KAC kelimeye bas harf oldugunu izolat basina bir kez sayar.
// Zincir modunda baslangic harfi secimi ve geriye-tarama fallback'i icin kullanilir.
let startCache: { raw: string; map: Map<string, number> } | null = null;
export function loadStartCounts(raw: string): Map<string, number> {
  if (startCache && startCache.raw === raw) return startCache.map;
  const map = new Map<string, number>();
  for (const line of raw.split('\n')) {
    const w = line.trim();
    if (!w) continue;
    const c = w[0];
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  startCache = { raw, map };
  return map;
}

// En az minCount kelimeye bas harf olan harfler (zincir baslangic havuzu).
export function eligibleStartLetters(counts: ReadonlyMap<string, number>, minCount: number): string[] {
  const out: string[] = [];
  for (const [letter, c] of counts) {
    if (c >= minCount) out.push(letter);
  }
  return out;
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
