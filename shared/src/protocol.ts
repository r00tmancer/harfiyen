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

// ---- Oyun modları ----
export type GameMode = 'harf' | 'sayi' | 'zincir' | 'uzun' | 'bom' | 'telepati';
export const DEFAULT_MODE: GameMode = 'harf';

// Telepati (Uyum Testi) — ko-op: aynı soruya gizlice cevap verin, uyuşursa ortak puan
export const TELEPATI_QUESTIONS = 10; // maç başına soru
export const TELEPATI_ANSWER_MS = 15_000;
export const TELEPATI_REVEAL_MS = 3_500;

// Bom (7 Bom): sırayla say, 7'nin katı veya içinde 7 geçen sayıda BOM de
export const BOM_LIVES = 3;
export const BOM_DIGIT = 7;
export const BOM_START_MS = 6_000; // ilk turların süresi
export const BOM_MIN_MS = 2_500; // taban süre
export const BOM_DECAY_MS = 150; // her sayıda süre bu kadar kısalır
// Bir sayıda BOM denmesi gerekiyor mu?
export function isBom(n: number): boolean {
  return n % BOM_DIGIT === 0 || String(n).includes(String(BOM_DIGIT));
}

// Sayı Avı
export const SAYI_MIN = 1;
export const SAYI_MAX = 100;
export const SAYI_ROUNDS_TO_WIN = 3; // 3 raund kazanan maçı alır
export const SAYI_PICK_MS = 15_000; // gizli sayı seçme süresi
export const SAYI_TURN_MS = 20_000; // tahmin sırası süresi (dolarsa sıra yanar)
// Termometre jokeri mesafe bantları (|tahmin - gizli|)
export const SAYI_BAND_KAYNIYOR = 3;
export const SAYI_BAND_SICAK = 10;
export const SAYI_BAND_ILIK = 25;

// Kelime Zinciri
export const ZINCIR_LIVES = 3;
export const ZINCIR_START_MS = 15_000; // ilk tur süresi
export const ZINCIR_MIN_MS = 6_000; // sürenin inebileceği taban
export const ZINCIR_DECAY_MS = 500; // her başarılı kelimede süre bu kadar kısalır

// En Uzun Kelime
export const UZUN_ROUND_MS = 30_000; // tek gönderimlik yarış süresi
export const UZUN_TARGET = 5; // maçı kazanmak için puan

// Mod başına joker türü (UI metni istemcide)
export type JokerKind = 'buz' | 'termometre' | 'pas' | 'cifte_sans' | 'sigorta' | 'cifte_kalp';
export const MODE_JOKER: Record<GameMode, JokerKind> = {
  harf: 'buz',
  sayi: 'termometre',
  zincir: 'pas',
  uzun: 'cifte_sans',
  bom: 'sigorta', // bir sonraki hatanı affeder (can gitmez)
  telepati: 'cifte_kalp', // bu soru eşleşirse 2 puan sayılır
};

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
  | 'picking' // (harf/uzun) iki oyuncu gizlice harf seçiyor
  | 'countdown' // 3-2-1
  | 'racing' // (harf) kelime yarışı
  | 'sayi_pick' // (sayi) iki oyuncu gizli sayısını seçiyor
  | 'sayi_turn' // (sayi) sıradaki oyuncu tahmin ediyor
  | 'zincir_turn' // (zincir) sıradaki oyuncu kelime yazıyor, bomba tıkırdıyor
  | 'uzun_race' // (uzun) tek gönderimlik uzun kelime yarışı
  | 'bom_turn' // (bom) sıradaki oyuncu sayıya ya da BOM'a basıyor
  | 'telepati_soru' // (telepati) iki oyuncu da gizlice cevaplıyor
  | 'telepati_reveal' // (telepati) cevaplar açıldı, eşleşme gösteriliyor
  | 'round_end' // raund sonucu gösteriliyor
  | 'match_end'; // maç bitti

// Sayı Avı: her oyuncunun RAKİBİN sayısı için bildiği aralık (tahminciye göre)
export interface SayiState {
  roundWins: Record<string, number>; // oyuncu id -> kazanılan raund
  bounds: Record<string, { lo: number; hi: number }>; // tahmin EDEN oyuncu id -> bildiği aralık (lo < x < hi)
  myNumber: number | null; // SADECE alıcının kendi gizli sayısı (snapshot kişiye özel)
  myPicked: boolean;
  oppPicked: boolean;
  equalizer: boolean; // ikinci oyuncunun eşitleme tahmini aşaması mı
}

export interface ZincirState {
  lives: Record<string, number>;
  lastWord: string | null;
  requiredLetter: string | null; // sıradaki kelimenin başlaması gereken harf
  turnMs: number; // bu turun toplam süresi (gitgide kısalır)
}

export interface UzunState {
  submitted: Record<string, boolean>; // kim kelimesini kilitledi (kelime gizli)
}

export interface BomState {
  lives: Record<string, number>;
  current: number; // sıradaki söylenecek sayı (ikisi de görür)
  turnMs: number; // bu turun süresi (gitgide kısalır)
  insured: Record<string, boolean>; // sigorta jokeri aktif mi (bir hatayı affeder)
}

export interface TelepatiQuestion {
  type: 'kim' | 'ab';
  q: string;
  a?: string; // ab tipinde şık metinleri
  b?: string;
}

export interface TelepatiState {
  qIndex: number; // 1..TELEPATI_QUESTIONS
  question: TelepatiQuestion;
  matches: number; // eşleşen soru puanı (çifte kalp ile bir soru 2 sayılabilir)
  myAnswered: boolean;
  oppAnswered: boolean;
  doubled: boolean; // bu soruda çifte kalp aktif mi
}

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
  mode: GameMode;
  phase: Phase;
  round: number; // 1'den başlar
  you: string; // senin oyuncu id'in
  players: PlayerPublic[];
  letters: [string, string] | null; // (harf/uzun) sadece yarış/round_end fazlarında dolu
  deadline: number | null; // aktif fazın bitişi, epoch ms (sunucu saati)
  usedWords: string[]; // bu maçta kabul edilmiş kelimeler (tekrar kullanılamaz)
  winner: string | null; // match_end'de kazanan oyuncu id'i
  frozenUntil: Record<string, number>; // (harf) oyuncu id -> buz jokerinin bittiği an
  turn: string | null; // (sayi/zincir/bom) sıra hangi oyuncuda
  sayi: SayiState | null;
  zincir: ZincirState | null;
  uzun: UzunState | null;
  bom: BomState | null;
  telepati: TelepatiState | null;
}

// ---- Mesajlar: istemci -> sunucu ----
export type ClientMsg =
  | { t: 'ready' }
  | { t: 'set_mode'; mode: GameMode } // sadece lobby'de, sadece odayı kuran (ilk oyuncu)
  | { t: 'pick_letter'; letter: string }
  | { t: 'submit_word'; word: string } // harf/zincir/uzun modlarında kelime gönderimi
  | { t: 'pick_number'; value: number } // (sayi) gizli sayı seçimi
  | { t: 'guess'; value: number } // (sayi) sıradaki tahmin
  | { t: 'bom_press'; kind: 'number' | 'bom' } // (bom) sıradaki oyuncunun seçimi
  | { t: 'telepati_answer'; choice: 'a' | 'b' | 'ben' | 'o' } // (telepati) gizli cevap
  | { t: 'use_joker' } // moda özel joker (MODE_JOKER)
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
  | { t: 'joker_used'; by: string; kind: JokerKind; until?: number } // until sadece buz için
  | { t: 'mode_set'; mode: GameMode } // lobby'de mod değişti
  // Sayı Avı
  | {
      t: 'guess_result';
      by: string; // tahmini yapan
      value: number;
      result: 'yukari' | 'asagi' | 'buldu' | 'kayniyor' | 'sicak' | 'ilik' | 'soguk'; // son dördü termometre jokeri
      bounds: { lo: number; hi: number } | null; // tahmincinin güncel aralığı (termometrede değişmez -> null olabilir)
    }
  // Kelime Zinciri
  | { t: 'zincir_word'; by: string; word: string; nextLetter: string; turnMs: number } // kabul edilen halka
  | { t: 'zincir_boom'; loser: string; lives: Record<string, number>; nextLetter: string | null } // süre doldu, can gitti
  // Bom
  | {
      t: 'bom_result';
      by: string;
      value: number; // basılan andaki sayı
      kind: 'number' | 'bom' | 'timeout';
      ok: boolean; // doğru hamle miydi
      insured: boolean; // hata sigortayla affedildi mi
      lives: Record<string, number>;
      next: number; // sıradaki sayı
      turnMs: number;
    }
  // Telepati
  | {
      t: 'telepati_reveal';
      match: boolean;
      // cevaplar: ab tipinde 'a'|'b'; kim tipinde işaret edilen OYUNCUNUN pid'i (UI nick'e çevirir)
      answers: Record<string, string>; // cevaplamayan oyuncunun anahtarı hiç yer almaz
      matches: number; // güncel toplam (çifte kalp uygulanmış)
      doubled: boolean; // bu soru 2 puan mı sayıldı
      qIndex: number;
    }
  // En Uzun Kelime
  | { t: 'uzun_locked'; by: string } // oyuncu kelimesini kilitledi (kelime gizli)
  | {
      t: 'uzun_reveal';
      words: Record<string, { word: string; len: number } | null>; // oyuncu id -> gönderdiği (null = göndermedi/geçersiz)
      winner: string | null;
      scores: Record<string, number>;
    }
  | { t: 'match_end'; winner: string | null; scores: Record<string, number>; word: string | null } // winner null = ko-op mod (telepati); word = maçı bitiren kelime (kelime modları)
  | { t: 'rematch_state'; want: string[] } // rövanş isteyen oyuncu id'leri
  | { t: 'opp_conn'; connected: boolean }
  | { t: 'error'; code: 'room_full' | 'not_found' | 'bad_msg'; msg?: string };

// ---- REST ----
// POST /api/rooms                 -> { code: string }
// GET  /api/rooms/:code           -> { exists: boolean, joinable: boolean }
// WS   /ws/:code?nick=..&avatar=..&pid=..   (pid: istemcinin localStorage'da sakladığı kalıcı uuid;
//                                            kopan bağlantıda aynı pid ile yeniden katılım sağlar)
