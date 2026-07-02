import { create } from 'zustand';
import { RACE_MS } from '@harfiyen/shared';
import type {
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
  jokerUse: { by: string; until: number; seq: number } | null; // tek seferlik animasyon icin
  wordInfos: Record<string, string>;
  rematchWants: string[];
  matchEndSeq: number;
  oppConnected: boolean;

  setNick(n: string): void;
  setAvatar(i: number): void;
  setJoinCode(c: string): void;
  prefillJoin(code: string): void;
  setBusy(b: boolean): void;
  setHomeError(e: string | null): void;
  setConn(c: ConnState): void;
  enterRoom(code: string): void;
  pickLetterLocal(letter: string): void;
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
            if (s.phase === 'picking') {
              patch.myLetter = null;
              patch.attempts = [];
              patch.roundResult = null;
              patch.lettersRerolled = false;
              // yeni mac (rovans) basladiysa eski istekler temizlenir
              if (prevPhase === 'match_end' || prevPhase === null) {
                patch.rematchWants = [];
                patch.wordInfos = {};
                patch.finalWord = null;
              }
            }
            if (s.phase === 'lobby') patch.rematchWants = [];
          }
          return patch;
        }

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
          return {
            snapshot: {
              ...st.snapshot,
              phase: 'racing',
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

        case 'word_rejected':
          return {
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

        case 'joker_used': {
          // by jokeri kullandi -> rakibi (diger oyuncu) donar
          if (!st.snapshot) return {};
          const frozenId = st.snapshot.players.find((p) => p.id !== msg.by)?.id;
          return {
            snapshot: {
              ...st.snapshot,
              frozenUntil: frozenId
                ? { ...st.snapshot.frozenUntil, [frozenId]: msg.until }
                : st.snapshot.frozenUntil,
              players: st.snapshot.players.map((p) =>
                p.id === msg.by ? { ...p, jokers: Math.max(0, p.jokers - 1) } : p,
              ),
            },
            jokerUse: { by: msg.by, until: msg.until, seq: (st.jokerUse?.seq ?? 0) + 1 },
          };
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
