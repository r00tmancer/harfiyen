// GameRoom — SQLite destekli, hibernation kullanan Durable Object.
// Tum zamanlama ctx.storage.setAlarm ile; setTimeout/setInterval KULLANILMAZ.
import { DurableObject } from 'cloudflare:workers';
import {
  AVATAR_COUNT,
  COUNTDOWN_MS,
  JOKER_FREEZE_MS,
  MAX_NICK_LEN,
  MIN_PAIR_WORDS,
  PICK_MS,
  RACE_MS,
  RESULT_MS,
  SUBMIT_THROTTLE_MS,
  TARGET_SCORE,
  TR_LETTERS,
  normalizeTr,
  pairKey,
} from '@harfiyen/shared';
import type { ClientMsg, Phase, RoomSnapshot, ServerMsg } from '@harfiyen/shared';
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
} from './game/logic';
import type { Env } from './env';
import wordsRaw from './data/words.txt';
import pairsJson from './data/pairs.json';
import badwordsJson from './data/badwords.json';

const CLEANUP_MS = 10 * 60_000;
const STATE_KEY = 'state';
const FALLBACK_NICK = 'Oyuncu';

interface PlayerState {
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

interface RoomState {
  code: string;
  phase: Phase;
  round: number;
  players: PlayerState[];
  letters: [string, string] | null; // sadece racing/round_end'de acik
  pending: { letters: [string, string]; rerolled: boolean } | null; // countdown boyunca gizli
  deadline: number | null;
  usedWords: string[];
  winner: string | null;
  jokers: Record<string, number>; // pid -> kalan buz jokeri hakki
  frozenUntil: Record<string, number>; // pid -> donmanin bittigi an (epoch ms)
  alarmPurpose: 'phase' | 'cleanup' | null;
}

interface Attachment {
  pid: string;
}

// Veri, izolat basina bir kez tembel olarak hazirlanir.
let pairsCache: Record<string, number> | null = null;
function getPairs(): Record<string, number> {
  pairsCache ??= toPairCounts(pairsJson);
  return pairsCache;
}
let badwordsCache: Set<string> | null = null;
function getBadwords(): Set<string> {
  badwordsCache ??= toWordSet(badwordsJson);
  return badwordsCache;
}

function randomLetter(): string {
  return TR_LETTERS[Math.floor(Math.random() * TR_LETTERS.length)];
}

export class GameRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return this.handleJoin(url);
    }
    if (url.pathname === '/reserve' && request.method === 'POST') {
      return this.handleReserve(url);
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const state = await this.getState();
      return Response.json({
        exists: state !== null,
        joinable: state !== null && state.players.length < 2,
      });
    }
    return new Response('bulunamadi', { status: 404 });
  }

  // ---- REST (worker icinden) ----

  private async handleReserve(url: URL): Promise<Response> {
    const existing = await this.getState();
    if (existing) return Response.json({ ok: false }, { status: 409 });
    const state: RoomState = {
      code: url.searchParams.get('code') ?? '',
      phase: 'lobby',
      round: 1,
      players: [],
      letters: null,
      pending: null,
      deadline: null,
      usedWords: [],
      winner: null,
      jokers: {},
      frozenUntil: {},
      alarmPurpose: 'cleanup', // kimse katilmazsa oda kendini temizler
    };
    await this.ctx.storage.setAlarm(Date.now() + CLEANUP_MS);
    await this.save(state);
    return Response.json({ ok: true });
  }

  // ---- Katilim ----

  private async handleJoin(url: URL): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const reject = (code: 'room_full' | 'not_found' | 'bad_msg', msg?: string): Response => {
      server.accept();
      server.send(JSON.stringify({ t: 'error', code, msg } satisfies ServerMsg));
      server.close(1008, code);
      return new Response(null, { status: 101, webSocket: client });
    };

    const state = await this.getState();
    if (!state) return reject('not_found');

    const pid = (url.searchParams.get('pid') ?? '').trim().slice(0, 64);
    if (!pid) return reject('bad_msg', 'pid gerekli');

    let player = state.players.find((p) => p.id === pid);
    if (!player) {
      if (state.players.length >= 2) return reject('room_full');
      const rawNick = (url.searchParams.get('nick') ?? '').trim().slice(0, MAX_NICK_LEN);
      const nick = rawNick && isNickClean(rawNick, getBadwords()) ? rawNick : FALLBACK_NICK;
      const avatarRaw = Number(url.searchParams.get('avatar'));
      const avatar = Number.isInteger(avatarRaw) && avatarRaw >= 0 && avatarRaw < AVATAR_COUNT ? avatarRaw : 0;
      player = {
        id: pid,
        nick,
        avatar,
        score: 0,
        connected: true,
        ready: false,
        pickedLetter: null,
        rematch: false,
        lastSubmitAt: 0,
      };
      state.players.push(player);
      state.jokers[player.id] = 1; // her oyuncu maca 1 jokerle baslar
    } else {
      // ayni pid geri geldi: eski soket(ler) kapatilir, yenisi gecer
      for (const old of this.ctx.getWebSockets(pid)) {
        try {
          old.close(1000, 'replaced');
        } catch {
          // zaten kapali olabilir
        }
      }
      player.connected = true;
    }

    if (state.alarmPurpose === 'cleanup') {
      await this.ctx.storage.deleteAlarm();
      state.alarmPurpose = null;
      // bos kalinca donmus faz makinesini tekrar kur
      if (state.phase !== 'lobby' && state.phase !== 'match_end' && state.deadline !== null) {
        state.alarmPurpose = 'phase';
        await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, state.deadline));
      }
    }

    await this.save(state);
    this.ctx.acceptWebSocket(server, [pid]);
    server.serializeAttachment({ pid } satisfies Attachment);
    this.sendToOthers(pid, { t: 'opp_conn', connected: true });
    this.broadcastSnapshot(state);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- WS mesajlari ----

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    const pid = this.pidOf(ws);
    if (!pid) return;

    let msg: ClientMsg;
    try {
      msg = JSON.parse(message) as ClientMsg;
    } catch {
      this.sendTo(ws, { t: 'error', code: 'bad_msg', msg: 'gecersiz json' });
      return;
    }

    const state = await this.getState();
    if (!state) return;
    const player = state.players.find((p) => p.id === pid);
    if (!player) return;

    switch (msg.t) {
      case 'ready':
        await this.onReady(state, player);
        break;
      case 'pick_letter':
        await this.onPickLetter(state, player, msg.letter);
        break;
      case 'submit_word':
        await this.onSubmitWord(state, player, ws, msg.word);
        break;
      case 'use_joker':
        await this.onUseJoker(state, player);
        break;
      case 'rematch':
        await this.onRematch(state, player);
        break;
      default:
        this.sendTo(ws, { t: 'error', code: 'bad_msg' });
    }
  }

  private async onReady(state: RoomState, player: PlayerState): Promise<void> {
    if (state.phase !== 'lobby') return;
    player.ready = true;
    if (state.players.length === 2 && state.players.every((p) => p.ready)) {
      await this.startPicking(state);
      return;
    }
    await this.save(state);
    this.broadcastSnapshot(state);
  }

  private async onPickLetter(state: RoomState, player: PlayerState, rawLetter: string): Promise<void> {
    if (state.phase !== 'picking') return;
    if (player.pickedLetter !== null) return; // ilk secim kilitler
    const letter = normalizeTr(String(rawLetter ?? ''));
    if (!(TR_LETTERS as readonly string[]).includes(letter)) return;
    player.pickedLetter = letter;
    this.sendToOthers(player.id, { t: 'opp_picked' });
    if (state.players.length === 2 && state.players.every((p) => p.pickedLetter !== null)) {
      await this.startCountdown(state);
      return;
    }
    await this.save(state);
  }

  private async onSubmitWord(state: RoomState, player: PlayerState, ws: WebSocket, rawWord: string): Promise<void> {
    const attempt = normalizeTr(String(rawWord ?? ''));
    if (state.phase !== 'racing' || !state.letters) {
      this.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'too_late' });
      return;
    }
    const now = Date.now();
    // donuk oyuncunun denemesi reddedilir; rakibe opp_rejected sinyali de gitmez
    if (isFrozen(state.frozenUntil, player.id, now)) {
      this.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'frozen' });
      return;
    }
    if (now - player.lastSubmitAt < SUBMIT_THROTTLE_MS) {
      this.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'throttled' });
      return;
    }
    player.lastSubmitAt = now;

    const verdict = validateWord(attempt, state.letters, new Set(state.usedWords), loadDict(wordsRaw));
    if (!verdict.ok) {
      await this.save(state);
      this.sendTo(ws, { t: 'word_rejected', word: attempt, reason: verdict.reason });
      this.sendToOthers(player.id, { t: 'opp_rejected' });
      return;
    }

    const word = verdict.word;
    state.usedWords.push(word);
    player.score += 1;
    state.frozenUntil = {}; // yaris bitiyor, donmalar temizlenir
    const scores = this.scoresOf(state);
    this.broadcast({ t: 'word_accepted', by: player.id, word, scores });
    this.ctx.waitUntil(this.fetchMeaning(word));

    if (player.score >= TARGET_SCORE) {
      state.phase = 'match_end';
      state.winner = player.id;
      state.letters = null;
      state.pending = null;
      state.deadline = null;
      state.alarmPurpose = null;
      await this.ctx.storage.deleteAlarm();
      await this.save(state);
      this.broadcast({ t: 'match_end', winner: player.id, scores, word });
      this.broadcastSnapshot(state);
      return;
    }

    state.phase = 'round_end';
    state.deadline = now + RESULT_MS;
    state.alarmPurpose = 'phase';
    await this.ctx.storage.setAlarm(state.deadline);
    await this.save(state);
    this.broadcast({ t: 'round_end', winner: player.id, word, scores });
    this.broadcastSnapshot(state);
  }

  // Buz jokeri: yalnizca racing fazinda, hak varsa ve rakip zaten donuk degilse.
  // Gecersiz kullanim sessizce yutulur (hata mesaji yok).
  private async onUseJoker(state: RoomState, player: PlayerState): Promise<void> {
    if (state.phase !== 'racing') return;
    const opponent = state.players.find((p) => p.id !== player.id);
    if (!opponent) return;
    const now = Date.now();
    if (!canUseJoker(state.jokers[player.id] ?? 0, isFrozen(state.frozenUntil, opponent.id, now))) return;

    state.jokers[player.id] = (state.jokers[player.id] ?? 0) - 1;
    const until = now + JOKER_FREEZE_MS;
    state.frozenUntil[opponent.id] = until;
    await this.save(state);
    this.broadcast({ t: 'joker_used', by: player.id, until });
    this.broadcastSnapshot(state);
  }

  private async onRematch(state: RoomState, player: PlayerState): Promise<void> {
    if (state.phase !== 'match_end') return;
    player.rematch = true;
    this.broadcast({ t: 'rematch_state', want: state.players.filter((p) => p.rematch).map((p) => p.id) });
    if (state.players.length === 2 && state.players.every((p) => p.rematch)) {
      for (const p of state.players) {
        p.score = 0;
        p.rematch = false;
        p.pickedLetter = null;
        state.jokers[p.id] = 1; // rovansta joker haklari sifirlanip 1'e doner
      }
      state.usedWords = [];
      state.winner = null;
      state.round = 1;
      state.frozenUntil = {};
      await this.startPicking(state);
      return;
    }
    await this.save(state);
  }

  // ---- Faz gecisleri ----

  private async startPicking(state: RoomState): Promise<void> {
    state.phase = 'picking';
    state.letters = null;
    state.pending = null;
    for (const p of state.players) p.pickedLetter = null;
    state.deadline = Date.now() + PICK_MS;
    state.alarmPurpose = 'phase';
    await this.ctx.storage.setAlarm(state.deadline);
    await this.save(state);
    this.broadcastSnapshot(state);
  }

  private async startCountdown(state: RoomState): Promise<void> {
    // secmeyene rastgele harf atanir
    for (const p of state.players) p.pickedLetter ??= randomLetter();
    const a = state.players[0]?.pickedLetter ?? randomLetter();
    const b = state.players[1]?.pickedLetter ?? randomLetter();
    let letters: [string, string] = [a, b];
    let rerolled = false;
    const pairs = getPairs();
    if ((pairs[pairKey(a, b)] ?? 0) < MIN_PAIR_WORDS) {
      const fallback = chooseFallbackPair(pairs, MIN_PAIR_WORDS, Math.random);
      if (fallback) {
        letters = fallback;
        rerolled = true;
      }
    }
    state.pending = { letters, rerolled };
    state.phase = 'countdown';
    state.deadline = Date.now() + COUNTDOWN_MS;
    state.alarmPurpose = 'phase';
    await this.ctx.storage.setAlarm(state.deadline);
    await this.save(state);
    this.broadcast({ t: 'countdown', from: 3 });
    this.broadcastSnapshot(state);
  }

  private async startRacing(state: RoomState): Promise<void> {
    const pending = state.pending ?? { letters: [randomLetter(), randomLetter()] as [string, string], rerolled: false };
    state.letters = pending.letters;
    state.pending = null;
    state.phase = 'racing';
    state.frozenUntil = {}; // yaris temiz baslar
    state.deadline = Date.now() + RACE_MS;
    state.alarmPurpose = 'phase';
    await this.ctx.storage.setAlarm(state.deadline);
    await this.save(state);
    this.broadcast({ t: 'letters', letters: pending.letters, rerolled: pending.rerolled });
    this.broadcastSnapshot(state);
  }

  // ---- Alarm ----

  async alarm(): Promise<void> {
    const state = await this.getState();
    if (!state) return;

    if (state.alarmPurpose === 'cleanup') {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      return;
    }
    state.alarmPurpose = null;

    // terk edilmis oda: faz dongusunu durdur, temizlige gec
    if (this.ctx.getWebSockets().length === 0) {
      state.alarmPurpose = 'cleanup';
      await this.ctx.storage.setAlarm(Date.now() + CLEANUP_MS);
      await this.save(state);
      return;
    }

    switch (state.phase) {
      case 'picking':
        await this.startCountdown(state);
        break;
      case 'countdown':
        await this.startRacing(state);
        break;
      case 'racing': {
        // sure doldu, kazanan yok
        state.phase = 'round_end';
        state.frozenUntil = {}; // yaristan cikarken bayat donmalar temizlenir
        state.deadline = Date.now() + RESULT_MS;
        state.alarmPurpose = 'phase';
        await this.ctx.storage.setAlarm(state.deadline);
        await this.save(state);
        this.broadcast({ t: 'round_end', winner: null, word: null, scores: this.scoresOf(state) });
        this.broadcastSnapshot(state);
        break;
      }
      case 'round_end':
        state.round += 1;
        // 6, 11, 16... raundlarin basinda iki oyuncuya da +1 joker
        if (jokerGrantedOnRound(state.round)) {
          for (const p of state.players) state.jokers[p.id] = (state.jokers[p.id] ?? 0) + 1;
        }
        await this.startPicking(state);
        break;
      default:
        await this.save(state);
    }
  }

  // ---- Baglanti kopmasi ----

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const pid = this.pidOf(ws);
    if (!pid) return;
    const state = await this.getState();
    if (!state) return;
    const player = state.players.find((p) => p.id === pid);
    if (!player) return;

    // ayni pid'in baska acik soketi varsa (reconnect ile degistirildi) bagli sayilir
    const stillOpen = this.ctx.getWebSockets(pid).some((s) => s !== ws);
    player.connected = stillOpen;
    if (!stillOpen) this.sendToOthers(pid, { t: 'opp_conn', connected: false });

    const anyOpen = this.ctx.getWebSockets().some((s) => s !== ws);
    if (!anyOpen && (state.phase === 'lobby' || state.phase === 'match_end')) {
      state.alarmPurpose = 'cleanup';
      await this.ctx.storage.setAlarm(Date.now() + CLEANUP_MS);
    }
    await this.save(state);
  }

  // ---- TDK anlami (asenkron, oyun beklemez) ----

  private async fetchMeaning(word: string): Promise<void> {
    try {
      const key = `meaning:${word}`;
      let meaning = await this.ctx.storage.get<string>(key);
      if (!meaning) {
        const res = await fetch(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(word)}`, {
          signal: AbortSignal.timeout(1500),
        });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (!Array.isArray(data)) return; // bulunamayinca {error} doner
        const first = data[0] as { anlamlarListe?: { anlam?: string }[] } | undefined;
        meaning = first?.anlamlarListe?.[0]?.anlam;
        if (!meaning) return;
        await this.ctx.storage.put(key, meaning);
      }
      this.broadcast({ t: 'word_info', word, meaning });
    } catch {
      // sessiz: anlam gelmezse oyun etkilenmez
    }
  }

  // ---- Yardimcilar ----

  private async getState(): Promise<RoomState | null> {
    const state = (await this.ctx.storage.get<RoomState>(STATE_KEY)) ?? null;
    if (state) {
      // joker alanlari sonradan eklendi; eski kayitlarda eksik olabilir
      state.jokers ??= {};
      state.frozenUntil ??= {};
    }
    return state;
  }

  private save(state: RoomState): Promise<void> {
    return this.ctx.storage.put(STATE_KEY, state);
  }

  private pidOf(ws: WebSocket): string | null {
    try {
      const att = ws.deserializeAttachment() as Attachment | null;
      return att?.pid ?? null;
    } catch {
      return null;
    }
  }

  private scoresOf(state: RoomState): Record<string, number> {
    return Object.fromEntries(state.players.map((p) => [p.id, p.score]));
  }

  private sendTo(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // kapanmakta olan soket
    }
  }

  private broadcast(msg: ServerMsg): void {
    for (const ws of this.ctx.getWebSockets()) this.sendTo(ws, msg);
  }

  private sendToOthers(pid: string, msg: ServerMsg): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (this.pidOf(ws) !== pid) this.sendTo(ws, msg);
    }
  }

  private broadcastSnapshot(state: RoomState): void {
    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.pidOf(ws);
      if (!pid) continue;
      this.sendTo(ws, { t: 'snapshot', state: this.snapshotFor(state, pid) });
    }
  }

  private snapshotFor(state: RoomState, you: string): RoomSnapshot {
    const lettersVisible = state.phase === 'racing' || state.phase === 'round_end';
    // suresi gecmis donmalar snapshot'a sizmasin
    const now = Date.now();
    const frozenUntil: Record<string, number> = {};
    for (const [pid, until] of Object.entries(state.frozenUntil)) {
      if (now < until) frozenUntil[pid] = until;
    }
    return {
      code: state.code,
      phase: state.phase,
      round: state.round,
      you,
      players: state.players.map((p) => ({
        id: p.id,
        nick: p.nick,
        avatar: p.avatar,
        score: p.score,
        connected: p.connected,
        ready: p.ready,
        pickedLetter: p.pickedLetter !== null,
        jokers: state.jokers[p.id] ?? 0,
      })),
      letters: lettersVisible ? state.letters : null,
      deadline: state.deadline,
      usedWords: state.usedWords,
      winner: state.winner,
      frozenUntil,
    };
  }
}
