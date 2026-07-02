import { create } from 'zustand';
import { RACE_MS, SAYI_TURN_MS, ZINCIR_START_MS } from '@harfiyen/shared';
import type {
  JokerKind,
  Phase,
  PlayerPublic,
  RoomSnapshot,
  ServerMsg,
  WordRejectReason,
} from '@harfiyen/shared';

export type Screen = 'home' | 'lobby' | 'game' | 'victory';
export type ConnState = 'idle' | 'connecting' | 'open' | 'reconnecting';

export interface Attempt {
  id: number;
  word: string;
  mine: boolean;
  ok: boolean;
  reason?: WordRejectReason;
}

export type GuessResult =
  | 'yukari'
  | 'asagi'
  | 'buldu'
  | 'kayniyor'
  | 'sicak'
  | 'ilik'
  | 'soguk';

export interface GuessEntry {
  id: number;
  by: string;
  value: number;
  result: GuessResult;
}

export const REJECT_TEXT: Record<WordRejectReason, string> = {
  not_in_dict: 'Sözlükte bulunamadı',
  wrong_pattern: 'Harflere uymuyor',
  already_used: 'Bu kelime zaten kullanıldı',
  too_short: 'En az 3 harf olmalı',
  too_late: 'Süre doldu',
  throttled: 'Biraz daha yavaş',
  frozen: 'Donmuş durumdasın!',
};

const NICK_KEY = 'harfiyen:nick';
const AVATAR_KEY = 'harfiyen:avatar';

let attemptId = 0;

function screenFor(phase: Phase): Screen {
  if (phase === 'lobby') return 'lobby';
  if (phase === 'match_end') return 'victory';
  return 'game';
}

export function meOf(s: RoomSnapshot): PlayerPublic | undefined {
  return s.players.find((p) => p.id === s.you);
}
export function oppOf(s: RoomSnapshot): PlayerPublic | undefined {
  return s.players.find((p) => p.id !== s.you);
}
// oyuncu rengi katilim sirasina gore: 0 -> pembe, 1 -> mavi
export function playerIndex(s: RoomSnapshot, id: string): 0 | 1 {
  return s.players.findIndex((p) => p.id === id) === 1 ? 1 : 0;
}

interface HarfiyenStore {
  screen: Screen;
  nick: string;
  avatar: number;
  joinCode: string;
  fromLink: boolean;
  busy: boolean;
  homeError: string | null;

  conn: ConnState;
  roomCode: string | null;
  snapshot: RoomSnapshot | null;

  myLetter: string | null;
  raceStartAt: number;
  lettersRerolled: boolean;
  attempts: Attempt[];
  lastAccepted: { by: string; word: string; seq: number } | null;
  lastRejected: { word: string; reason: WordRejectReason; seq: number } | null;
  oppRejectedSeq: number;
  roundResult: { winner: string | null; word: string | null } | null;
  finalWord: string | null; // maci bitiren kelime (match_end'den)
  jokerUse: { by: string; kind: JokerKind; until: number | null; seq: number } | null; // tek seferlik animasyon icin
  wordInfos: Record<string, string>;
  rematchWants: string[];
  matchEndSeq: number;
  oppConnected: boolean;

  // ---- sayi avi ----
  guessLog: GuessEntry[];
  lastGuess: { by: string; value: number; result: GuessResult; seq: number } | null;
  thermoArmedBy: string | null; // termometre jokeri kimde kurulu

  // ---- kelime zinciri ----
  lastZincir: { by: string; word: string; seq: number } | null;
  zincirBoom: { loser: string; seq: number } | null;

  // ---- bom ----
  // seq: her sonucta artar, animasyonlar tam-bir-kez tetiklenir
  lastBom: {
    by: string;
    value: number;
    kind: 'number' | 'bom' | 'timeout';
    ok: boolean;
    insured: boolean;
    seq: number;
  } | null;

  // ---- en uzun kelime ----
  myUzunTries: { word: string; rejected: boolean }[]; // bu raundda gonderdiklerim
  uzunExtra: boolean; // cifte sans jokerini bu raund kullandim mi
  uzunLocked: { by: string; seq: number } | null;
  uzunReveal: {
    words: Record<string, { word: string; len: number } | null>;
    winner: string | null;
    seq: number;
  } | null;

  setNick(n: string): void;
  setAvatar(i: number): void;
  setJoinCode(c: string): void;
  prefillJoin(code: string): void;
  setBusy(b: boolean): void;
  setHomeError(e: string | null): void;
  setConn(c: ConnState): void;
  enterRoom(code: string): void;
  pickLetterLocal(letter: string): void;
  uzunTryLocal(word: string): void;
  leaveToHome(): void;
  remainingMs(): number;
  apply(msg: ServerMsg): void;
}

const roomDefaults = {
  conn: 'idle' as ConnState,
  roomCode: null as string | null,
  snapshot: null as RoomSnapshot | null,
  myLetter: null as string | null,
  raceStartAt: 0,
  lettersRerolled: false,
  attempts: [] as Attempt[],
  lastAccepted: null,
  lastRejected: null,
  oppRejectedSeq: 0,
  roundResult: null,
  finalWord: null as string | null,
  jokerUse: null,
  wordInfos: {} as Record<string, string>,
  rematchWants: [] as string[],
  oppConnected: false,
  guessLog: [] as GuessEntry[],
  lastGuess: null,
  thermoArmedBy: null as string | null,
  lastZincir: null,
  zincirBoom: null,
  lastBom: null,
  myUzunTries: [] as { word: string; rejected: boolean }[],
  uzunExtra: false,
  uzunLocked: null,
  uzunReveal: null,
};

export const useStore = create<HarfiyenStore>()((set, get) => ({
  screen: 'home',
  nick: localStorage.getItem(NICK_KEY) ?? '',
  avatar: Number(localStorage.getItem(AVATAR_KEY) ?? '0') % 8,
  joinCode: '',
  fromLink: false,
  busy: false,
  homeError: null,
  matchEndSeq: 0, // oda sifirlansa da sayac artmaya devam eder (kutlama tekrari engeli)
  ...roomDefaults,

  setNick: (n) => {
    localStorage.setItem(NICK_KEY, n);
    set({ nick: n });
  },
  setAvatar: (i) => {
    localStorage.setItem(AVATAR_KEY, String(i));
    set({ avatar: i });
  },
  setJoinCode: (c) => set({ joinCode: c }),
  prefillJoin: (code) => set({ joinCode: code, fromLink: true }),
  setBusy: (b) => set({ busy: b }),
  setHomeError: (e) => set({ homeError: e }),
  setConn: (c) => set({ conn: c }),

  enterRoom: (code) =>
    set({ ...roomDefaults, roomCode: code, conn: 'connecting', screen: 'lobby', homeError: null }),

  pickLetterLocal: (letter) => set({ myLetter: letter }),

  // (uzun) gonderim hakki yerelde dusulur; throttled reddinde geri iade edilir
  uzunTryLocal: (word) =>
    set((st) => ({ myUzunTries: [...st.myUzunTries, { word, rejected: false }] })),

  leaveToHome: () => set({ ...roomDefaults, screen: 'home', fromLink: false, joinCode: '' }),

  remainingMs: () => {
    const d = get().snapshot?.deadline ?? null;
    return d === null ? 0 : Math.max(0, d - Date.now());
  },

  apply: (msg) =>
    set((st): Partial<HarfiyenStore> => {
      switch (msg.t) {
        case 'snapshot': {
          const s = msg.state;
          const prevPhase = st.snapshot?.phase ?? null;
          const opp = oppOf(s);
          const patch: Partial<HarfiyenStore> = {
            snapshot: s,
            roomCode: s.code,
            screen: screenFor(s.phase),
            oppConnected: opp ? opp.connected : false,
          };
          if (prevPhase !== s.phase) {
            // yeni mac (rovans/ilk mac) herhangi bir baslangic fazina gecince eski kalintilari sil
            const freshMatch =
              prevPhase === 'match_end' || prevPhase === null || prevPhase === 'lobby';
            if (freshMatch && s.phase !== 'lobby' && s.phase !== 'match_end') {
              patch.rematchWants = [];
              patch.wordInfos = {};
              patch.finalWord = null;
              patch.lastZincir = null;
              patch.zincirBoom = null;
              patch.lastBom = null;
              patch.uzunReveal = null;
            }
            if (s.phase === 'picking') {
              patch.myLetter = null;
              patch.attempts = [];
              patch.roundResult = null;
              patch.lettersRerolled = false;
              patch.myUzunTries = [];
              patch.uzunExtra = false;
              patch.uzunReveal = null;
              patch.uzunLocked = null;
            }
            if (s.phase === 'sayi_pick') {
              patch.guessLog = [];
              patch.lastGuess = null;
              patch.thermoArmedBy = null;
              patch.roundResult = null;
            }
            if (s.phase === 'lobby') patch.rematchWants = [];
          }
          return patch;
        }

        case 'mode_set':
          return st.snapshot ? { snapshot: { ...st.snapshot, mode: msg.mode } } : {};

        case 'opp_picked': {
          if (!st.snapshot) return {};
          const you = st.snapshot.you;
          return {
            snapshot: {
              ...st.snapshot,
              players: st.snapshot.players.map((p) =>
                p.id === you ? p : { ...p, pickedLetter: true },
              ),
            },
          };
        }

        case 'countdown':
          // sayim gorseli deadline uzerinden yurur; snapshot gelene dek yerel tahmin kullan
          return st.snapshot
            ? {
                snapshot: {
                  ...st.snapshot,
                  phase: 'countdown',
                  deadline: Date.now() + msg.from * 1000,
                },
              }
            : {};

        case 'letters': {
          if (!st.snapshot) return {};
          // (harf) yaris baslar; (uzun) uzun_race baslar — faz snapshot'la kesinlesir
          const nextPhase: Phase = st.snapshot.mode === 'uzun' ? 'uzun_race' : 'racing';
          return {
            snapshot: {
              ...st.snapshot,
              phase: nextPhase,
              letters: msg.letters,
              deadline: Date.now() + RACE_MS, // snapshot gelince sunucu degeriyle duzelir
            },
            lettersRerolled: msg.rerolled,
            raceStartAt: Date.now(),
            attempts: msg.rerolled ? [] : st.attempts,
          };
        }

        case 'word_accepted': {
          if (!st.snapshot) return {};
          return {
            snapshot: {
              ...st.snapshot,
              players: st.snapshot.players.map((p) => ({
                ...p,
                score: msg.scores[p.id] ?? p.score,
              })),
              usedWords: [...st.snapshot.usedWords, msg.word],
            },
            attempts: [
              ...st.attempts,
              { id: ++attemptId, word: msg.word, mine: msg.by === st.snapshot.you, ok: true },
            ].slice(-6),
            lastAccepted: { by: msg.by, word: msg.word, seq: (st.lastAccepted?.seq ?? 0) + 1 },
          };
        }

        case 'word_rejected': {
          const patch: Partial<HarfiyenStore> = {
            attempts: [
              ...st.attempts,
              { id: ++attemptId, word: msg.word, mine: true, ok: false, reason: msg.reason },
            ].slice(-6),
            lastRejected: {
              word: msg.word,
              reason: msg.reason,
              seq: (st.lastRejected?.seq ?? 0) + 1,
            },
          };
          // (uzun) gecersiz kelime de hak yakar; throttled ise hak iade edilir
          if (st.snapshot?.mode === 'uzun' && st.snapshot.phase === 'uzun_race') {
            if (msg.reason === 'throttled') {
              patch.myUzunTries = st.myUzunTries.slice(0, -1);
            } else {
              patch.myUzunTries = st.myUzunTries.map((t, i) =>
                i === st.myUzunTries.length - 1 ? { ...t, rejected: true } : t,
              );
            }
          }
          return patch;
        }

        case 'opp_rejected':
          return { oppRejectedSeq: st.oppRejectedSeq + 1 };

        case 'round_end': {
          const patch: Partial<HarfiyenStore> = {
            roundResult: { winner: msg.winner, word: msg.word },
          };
          if (st.snapshot) {
            patch.snapshot = {
              ...st.snapshot,
              phase: 'round_end',
              players: st.snapshot.players.map((p) => ({
                ...p,
                score: msg.scores[p.id] ?? p.score,
              })),
            };
          }
          return patch;
        }

        case 'word_info':
          return { wordInfos: { ...st.wordInfos, [msg.word]: msg.meaning } };

        // ---- sayi avi ----
        case 'guess_result': {
          if (!st.snapshot) return {};
          const s = st.snapshot;
          const other = s.players.find((p) => p.id !== msg.by)?.id ?? null;
          const found = msg.result === 'buldu';
          const patch: Partial<HarfiyenStore> = {
            guessLog: [
              ...st.guessLog,
              { id: ++attemptId, by: msg.by, value: msg.value, result: msg.result },
            ].slice(-12),
            lastGuess: {
              by: msg.by,
              value: msg.value,
              result: msg.result,
              seq: (st.lastGuess?.seq ?? 0) + 1,
            },
            snapshot: {
              ...s,
              sayi:
                s.sayi && msg.bounds
                  ? { ...s.sayi, bounds: { ...s.sayi.bounds, [msg.by]: msg.bounds } }
                  : s.sayi,
              // buldu degilse sira rakibe gecer; sunucu snapshot'i gelince kesinlesir
              turn: found ? s.turn : other,
              deadline: found ? s.deadline : Date.now() + SAYI_TURN_MS,
            },
          };
          if (st.thermoArmedBy === msg.by) patch.thermoArmedBy = null;
          return patch;
        }

        // ---- kelime zinciri ----
        case 'zincir_word': {
          if (!st.snapshot) return {};
          const s = st.snapshot;
          const other = s.players.find((p) => p.id !== msg.by)?.id ?? s.turn;
          return {
            lastZincir: { by: msg.by, word: msg.word, seq: (st.lastZincir?.seq ?? 0) + 1 },
            snapshot: {
              ...s,
              round: s.round + 1, // round = kabul edilen halka + 1
              turn: other,
              deadline: Date.now() + msg.turnMs,
              usedWords: [...s.usedWords, msg.word],
              zincir: s.zincir
                ? { ...s.zincir, lastWord: msg.word, requiredLetter: msg.nextLetter, turnMs: msg.turnMs }
                : s.zincir,
            },
          };
        }

        case 'zincir_boom': {
          const patch: Partial<HarfiyenStore> = {
            zincirBoom: { loser: msg.loser, seq: (st.zincirBoom?.seq ?? 0) + 1 },
          };
          if (st.snapshot) {
            const s = st.snapshot;
            const other = s.players.find((p) => p.id !== msg.loser)?.id ?? null;
            patch.snapshot = {
              ...s,
              turn: other,
              deadline: Date.now() + ZINCIR_START_MS,
              zincir: s.zincir
                ? {
                    ...s.zincir,
                    lives: msg.lives,
                    requiredLetter: msg.nextLetter ?? s.zincir.requiredLetter,
                    turnMs: ZINCIR_START_MS,
                  }
                : s.zincir,
            };
          }
          return patch;
        }

        // ---- bom ----
        case 'bom_result': {
          if (!st.snapshot) return {};
          const s = st.snapshot;
          // her sonucta (dogru/yanlis/timeout) sira rakibe gecer
          const other = s.players.find((p) => p.id !== msg.by)?.id ?? s.turn;
          return {
            lastBom: {
              by: msg.by,
              value: msg.value,
              kind: msg.kind,
              ok: msg.ok,
              insured: msg.insured,
              seq: (st.lastBom?.seq ?? 0) + 1,
            },
            snapshot: {
              ...s,
              round: msg.next, // round = sayilacak sayi (UI ust bilgide gosterir)
              turn: other,
              deadline: Date.now() + msg.turnMs, // sunucu snapshot'i gelince kesinlesir
              bom: s.bom
                ? {
                    ...s.bom,
                    lives: msg.lives,
                    current: msg.next,
                    turnMs: msg.turnMs,
                    // sigorta hatayi affettiyse tuketilir
                    insured: msg.insured
                      ? { ...s.bom.insured, [msg.by]: false }
                      : s.bom.insured,
                  }
                : s.bom,
            },
          };
        }

        // ---- en uzun kelime ----
        case 'uzun_locked': {
          const patch: Partial<HarfiyenStore> = {
            uzunLocked: { by: msg.by, seq: (st.uzunLocked?.seq ?? 0) + 1 },
          };
          if (st.snapshot?.uzun) {
            patch.snapshot = {
              ...st.snapshot,
              uzun: {
                ...st.snapshot.uzun,
                submitted: { ...st.snapshot.uzun.submitted, [msg.by]: true },
              },
            };
          }
          return patch;
        }

        case 'uzun_reveal': {
          const winWord = msg.winner ? (msg.words[msg.winner]?.word ?? null) : null;
          const patch: Partial<HarfiyenStore> = {
            uzunReveal: {
              words: msg.words,
              winner: msg.winner,
              seq: (st.uzunReveal?.seq ?? 0) + 1,
            },
            roundResult: { winner: msg.winner, word: winWord },
          };
          if (st.snapshot) {
            patch.snapshot = {
              ...st.snapshot,
              phase: 'round_end', // gosterim penceresi; snapshot gelince kesinlesir
              players: st.snapshot.players.map((p) => ({
                ...p,
                score: msg.scores[p.id] ?? p.score,
              })),
            };
          }
          return patch;
        }

        case 'joker_used': {
          if (!st.snapshot) return {};
          const s = st.snapshot;
          const otherId = s.players.find((p) => p.id !== msg.by)?.id ?? null;
          const patch: Partial<HarfiyenStore> = {
            jokerUse: {
              by: msg.by,
              kind: msg.kind,
              until: msg.until ?? null,
              seq: (st.jokerUse?.seq ?? 0) + 1,
            },
          };
          let snap: RoomSnapshot = {
            ...s,
            players: s.players.map((p) =>
              p.id === msg.by ? { ...p, jokers: Math.max(0, p.jokers - 1) } : p,
            ),
          };
          // buz: rakip donar
          if (msg.kind === 'buz' && msg.until !== undefined && otherId) {
            snap = { ...snap, frozenUntil: { ...snap.frozenUntil, [otherId]: msg.until } };
          }
          // termometre: sonraki tahmin banda cevrilir
          if (msg.kind === 'termometre') patch.thermoArmedBy = msg.by;
          // pas: ayni harfle sira rakibe, mevcut turnMs ile taze sure
          if (msg.kind === 'pas') {
            snap = {
              ...snap,
              turn: otherId ?? snap.turn,
              deadline: Date.now() + (snap.zincir?.turnMs ?? ZINCIR_START_MS),
            };
          }
          // cifte sans: bu raund icin +1 gonderim hakki
          if (msg.kind === 'cifte_sans' && msg.by === s.you) patch.uzunExtra = true;
          // sigorta: kullananin bir sonraki hatasi affedilir
          if (msg.kind === 'sigorta' && snap.bom) {
            snap = {
              ...snap,
              bom: { ...snap.bom, insured: { ...snap.bom.insured, [msg.by]: true } },
            };
          }
          patch.snapshot = snap;
          return patch;
        }

        case 'match_end': {
          const patch: Partial<HarfiyenStore> = {
            screen: 'victory',
            matchEndSeq: st.matchEndSeq + 1,
            finalWord: msg.word,
          };
          if (st.snapshot) {
            patch.snapshot = {
              ...st.snapshot,
              phase: 'match_end',
              winner: msg.winner,
              players: st.snapshot.players.map((p) => ({
                ...p,
                score: msg.scores[p.id] ?? p.score,
              })),
            };
          }
          return patch;
        }

        case 'rematch_state':
          return { rematchWants: msg.want };

        case 'opp_conn': {
          const patch: Partial<HarfiyenStore> = { oppConnected: msg.connected };
          if (st.snapshot) {
            const you = st.snapshot.you;
            patch.snapshot = {
              ...st.snapshot,
              players: st.snapshot.players.map((p) =>
                p.id === you ? p : { ...p, connected: msg.connected },
              ),
            };
          }
          return patch;
        }

        case 'error': {
          if (msg.code === 'room_full' || msg.code === 'not_found') {
            return {
              ...roomDefaults,
              screen: 'home',
              homeError: msg.code === 'room_full' ? 'Oda dolu' : 'Oda bulunamadı',
            };
          }
          return {};
        }

        default:
          return {};
      }
    }),
}));
