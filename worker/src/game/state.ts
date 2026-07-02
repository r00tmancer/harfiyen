// GameRoom kalici durum modelleri ve mod isleyicilerinin kullandigi baglam arayuzu.
// Sunucu tarafi durum, snapshot'tan AYRIDIR: gizli bilgiler (sayi sirlari) burada tutulur,
// snapshot'a asla sizmaz (round_end aralik-daraltma acilimi haric).
import type { GameMode, Phase, ServerMsg } from '@harfiyen/shared';

export interface PlayerState {
  id: string;
  nick: string;
  avatar: number;
  score: number;
  connected: boolean;
  ready: boolean;
  pickedLetter: string | null; // secilen harf gizli tutulur, snapshot'ta boolean'a indirgenir
  rematch: boolean;
  lastSubmitAt: number;
}

// ---- Moda ozel sunucu durumlari (gizli alanlar dahil) ----

export interface SayiServer {
  roundWins: Record<string, number>; // pid -> kazanilan raund
  secrets: Record<string, number | null>; // pid -> gizli sayi (SADECE sunucu)
  picked: Record<string, boolean>; // pid -> sayisini kilitledi mi
  bounds: Record<string, { lo: number; hi: number }>; // tahmin eden pid -> RAKIP sayisi icin bilinen aralik
  thermo: Record<string, boolean>; // pid -> sonraki tahmin termometreli mi
  equalizer: boolean; // eşitleme asamasi aktif mi
  starter: string | null; // bu raundun baslatici pid'i (raundlar arasi alternatif icin saklanir)
}

export interface ZincirServer {
  lives: Record<string, number>;
  lastWord: string | null;
  requiredLetter: string | null;
  turnMs: number; // bu turun toplam suresi (gitgide kisalir)
  acceptedCount: number; // kabul edilen kelime sayisi (round = +1)
}

export interface UzunServer {
  rights: Record<string, number>; // pid -> bu raunt kalan gonderim hakki
  best: Record<string, { word: string; len: number; at: number } | null>; // pid -> en iyi gecerli gonderim
  submitted: Record<string, boolean>; // pid -> kilitlendi mi (hak kalmadi)
}

export interface RoomState {
  code: string;
  mode: GameMode;
  creator: string | null; // odayi kuran (ilk katilan) pid; set_mode yalniz ona acik
  phase: Phase;
  round: number;
  turn: string | null; // (sayi/zincir) sira hangi oyuncuda
  players: PlayerState[];
  letters: [string, string] | null; // sadece racing/uzun_race/round_end'de acik
  pending: { letters: [string, string]; rerolled: boolean } | null; // countdown boyunca gizli
  deadline: number | null;
  usedWords: string[];
  winner: string | null;
  jokers: Record<string, number>; // pid -> kalan joker hakki (mod basina tur MODE_JOKER)
  frozenUntil: Record<string, number>; // (harf) pid -> donmanin bittigi an (epoch ms)
  alarmPurpose: 'phase' | 'cleanup' | null;
  sayi: SayiServer | null;
  zincir: ZincirServer | null;
  uzun: UzunServer | null;
}

// Mod isleyicilerine verilen dar baglam. GameRoom bu metotlari saglar; boylece
// soket/alarm/depolama ayrintilari DO kabuğunda kalir, mod dosyalari saf akista yogunlasir.
export interface RoomCtx {
  broadcast(msg: ServerMsg): void;
  sendTo(ws: WebSocket, msg: ServerMsg): void;
  sendToOthers(pid: string, msg: ServerMsg): void;
  broadcastSnapshot(state: RoomState): void;
  save(state: RoomState): Promise<void>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  scoresOf(state: RoomState): Record<string, number>;
  dict(): ReadonlySet<string>;
  pairs(): Readonly<Record<string, number>>;
  startCounts(): ReadonlyMap<string, number>;
  fetchMeaning(word: string): void; // ates-et-unut (harf modu TDK anlami)
}
