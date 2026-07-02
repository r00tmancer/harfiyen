// Harfiyen — istemci ile sunucunun ortak sözleşmesi.
// Bu dosya hem worker hem web tarafından import edilir; değişiklikler iki tarafı da kırar.

// ---- Oyun sabitleri ----
export const TARGET_SCORE = 5; // maçı kazanmak için gereken puan
export const PICK_MS = 10_000; // harf seçme süresi
export const COUNTDOWN_MS = 3_000; // 3-2-1 geri sayım
export const RACE_MS = 45_000; // kelime yarışı süresi (kimse bulamazsa harfler yenilenir)
export const RESULT_MS = 4_000; // raund sonucu ekranda kalma süresi (rakip, kazanan kelimeyi rahat okuyabilmeli)
export const MIN_WORD_LEN = 3;
export const MIN_PAIR_WORDS = 3; // bir harf çiftinin kabul edilmesi için gereken asgari çözüm sayısı
export const SUBMIT_THROTTLE_MS = 350;
export const MAX_NICK_LEN = 12;
export const AVATAR_COUNT = 8;
export const JOKER_FREEZE_MS = 5_000; // buz jokeri: rakibin yazma alanı bu kadar donar
export const JOKER_PER_ROUNDS = 5; // her 5 raundluk blok için 1 joker hakkı (1. ve 6. raundda dolar)

export const TR_LETTERS = [
  'a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l',
  'm', 'n', 'o', 'ö', 'p', 'r', 's', 'ş', 't', 'u', 'ü', 'v', 'y', 'z',
] as const;
export type TrLetter = (typeof TR_LETTERS)[number];

// ---- Türkçe normalizasyon ----
// DİKKAT: plain toLowerCase() Türkçede yanlıştır ('I' -> 'i' verir, 'ı' vermez).
// Sözlükteki şapkalı harfler (kâğıt, askerî) sadeleştirilir; kelime listesi de aynı biçimde üretilir.
export function normalizeTr(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

// Sırasız harf çifti anahtarı; pairs.json bu anahtarla indekslidir.
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('');
}

// Kelime, harflerden biriyle başlayıp diğeriyle bitmeli (iki yön de geçerli).
export function matchesPattern(word: string, l1: string, l2: string): boolean {
  const start = word[0];
  const end = word[word.length - 1];
  return (start === l1 && end === l2) || (start === l2 && end === l1);
}

// ---- Durum modelleri ----
export type Phase =
  | 'lobby' // rakip bekleniyor / hazır olma
  | 'picking' // iki oyuncu gizlice harf seçiyor
  | 'countdown' // 3-2-1
  | 'racing' // kelime yarışı
  | 'round_end' // raund sonucu gösteriliyor
  | 'match_end'; // maç bitti

export interface PlayerPublic {
  id: string;
  nick: string;
  avatar: number; // 0..AVATAR_COUNT-1
  score: number;
  connected: boolean;
  ready: boolean;
  pickedLetter: boolean; // bu raund harfini kilitledi mi (harfin kendisi gizli kalır)
  jokers: number; // kalan buz jokeri hakkı
}

export interface RoomSnapshot {
  code: string;
  phase: Phase;
  round: number; // 1'den başlar
  you: string; // senin oyuncu id'in
  players: PlayerPublic[];
  letters: [string, string] | null; // sadece racing/round_end fazlarında dolu
  deadline: number | null; // aktif fazın bitişi, epoch ms (sunucu saati)
  usedWords: string[]; // bu maçta kabul edilmiş kelimeler (tekrar kullanılamaz)
  winner: string | null; // match_end'de kazanan oyuncu id'i
  frozenUntil: Record<string, number>; // oyuncu id -> buz jokerinin bittiği an (epoch ms); donuk değilse yok
}

// ---- Mesajlar: istemci -> sunucu ----
export type ClientMsg =
  | { t: 'ready' }
  | { t: 'pick_letter'; letter: string }
  | { t: 'submit_word'; word: string }
  | { t: 'use_joker' } // buz jokeri: yalnızca racing fazında, hak varsa
  | { t: 'rematch' };

// ---- Mesajlar: sunucu -> istemci ----
export type WordRejectReason =
  | 'not_in_dict'
  | 'wrong_pattern'
  | 'already_used'
  | 'too_short'
  | 'too_late'
  | 'throttled'
  | 'frozen'; // buz jokeri yüzünden donuk

export type ServerMsg =
  | { t: 'snapshot'; state: RoomSnapshot } // katılım/yeniden bağlanma ve her faz değişiminde tam durum
  | { t: 'opp_picked' } // rakip harfini kilitledi
  | { t: 'countdown'; from: number } // geri sayım başlangıcı (istemci 3-2-1 animasyonu oynatır)
  | { t: 'letters'; letters: [string, string]; rerolled: boolean } // yarış başlangıcında açıklanır
  | { t: 'word_accepted'; by: string; word: string; scores: Record<string, number> }
  | { t: 'word_rejected'; word: string; reason: WordRejectReason } // yalnızca gönderene
  | { t: 'opp_rejected' } // rakip denedi-tutmadı sinyali (küçük vfx için)
  | { t: 'round_end'; winner: string | null; word: string | null; scores: Record<string, number> }
  | { t: 'word_info'; word: string; meaning: string } // TDK anlamı, asenkron gelebilir
  | { t: 'joker_used'; by: string; until: number } // buz jokeri kullanıldı; until = donma bitişi (epoch ms)
  | { t: 'match_end'; winner: string; scores: Record<string, number>; word: string | null } // word = maçı bitiren kelime
  | { t: 'rematch_state'; want: string[] } // rövanş isteyen oyuncu id'leri
  | { t: 'opp_conn'; connected: boolean }
  | { t: 'error'; code: 'room_full' | 'not_found' | 'bad_msg'; msg?: string };

// ---- REST ----
// POST /api/rooms                 -> { code: string }
// GET  /api/rooms/:code           -> { exists: boolean, joinable: boolean }
// WS   /ws/:code?nick=..&avatar=..&pid=..   (pid: istemcinin localStorage'da sakladığı kalıcı uuid;
//                                            kopan bağlantıda aynı pid ile yeniden katılım sağlar)
