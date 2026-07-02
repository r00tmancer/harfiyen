// Kelime Zinciri modu: her kelime bir onceki kelimenin son harfiyle baslar, sure gitgide kisalir,
// sure dolarsa bomba patlar (can gider). Pas jokeri sirayi devreder.
import {
  COUNTDOWN_MS,
  SUBMIT_THROTTLE_MS,
  ZINCIR_LIVES,
  ZINCIR_START_MS,
  normalizeTr,
} from '@harfiyen/shared';
import { decayTurnMs, eligibleStartLetters, nextRequiredLetter, validateZincir } from '../logic';
import type { PlayerState, RoomCtx, RoomState } from '../state';

// En az bu kadar kelimeye bas harf olan harfler baslangic havuzuna girer.
const ZINCIR_START_MIN_WORDS = 300;

function opponentOf(state: RoomState, pid: string): PlayerState | undefined {
  return state.players.find((p) => p.id !== pid);
}

// Baslangic/bomba sonrasi guvenli bas harfi: en az 300 kelimelik havuzdan rastgele.
function pickStartLetter(ctx: RoomCtx): string {
  const counts = ctx.startCounts();
  const pool = eligibleStartLetters(counts, ZINCIR_START_MIN_WORDS);
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  // Beklenmedik: havuz bos ise bas harf olabilen herhangi bir harf.
  const any = [...counts.keys()];
  return any.length > 0 ? any[Math.floor(Math.random() * any.length)] : 'a';
}

// Mac basi (ilk kez / rovans): canlar dolar, 3-2-1 geri sayim baslar.
export async function startMatch(ctx: RoomCtx, state: RoomState): Promise<void> {
  const lives: Record<string, number> = {};
  for (const p of state.players) lives[p.id] = ZINCIR_LIVES;
  state.zincir = {
    lives,
    lastWord: null,
    requiredLetter: null,
    turnMs: ZINCIR_START_MS,
    acceptedCount: 0,
  };
  state.round = 1;
  state.turn = null;
  state.letters = null;
  state.pending = null;
  state.phase = 'countdown';
  state.deadline = Date.now() + COUNTDOWN_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({ t: 'countdown', from: 3 });
  ctx.broadcastSnapshot(state);
}

// Geri sayim bitti: baslangic harfi ve rastgele baslayan oyuncu belirlenir.
export async function startTurn(ctx: RoomCtx, state: RoomState): Promise<void> {
  const z = state.zincir;
  if (!z) return;
  z.requiredLetter = pickStartLetter(ctx);
  z.turnMs = ZINCIR_START_MS;
  const first = state.players[Math.floor(Math.random() * state.players.length)];
  state.turn = first?.id ?? null;
  state.phase = 'zincir_turn';
  state.round = z.acceptedCount + 1;
  state.deadline = Date.now() + z.turnMs;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

export async function onSubmit(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  ws: WebSocket,
  rawWord: string,
): Promise<void> {
  const attempt = normalizeTr(String(rawWord ?? ''));
  if (state.phase !== 'zincir_turn' || !state.zincir) {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'too_late' });
    return;
  }
  if (state.turn !== player.id) {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'too_late' }); // sira sende degil
    return;
  }
  const now = Date.now();
  if (now - player.lastSubmitAt < SUBMIT_THROTTLE_MS) {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'throttled' });
    return;
  }
  player.lastSubmitAt = now;

  const z = state.zincir;
  const verdict = validateZincir(attempt, z.requiredLetter ?? '', new Set(state.usedWords), ctx.dict());
  if (!verdict.ok) {
    await ctx.save(state); // lastSubmitAt kalici olsun
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: verdict.reason });
    ctx.sendToOthers(player.id, { t: 'opp_rejected' });
    return; // sure YURUMEYE devam eder
  }

  const word = verdict.word;
  state.usedWords.push(word);
  z.lastWord = word;
  z.acceptedCount += 1;
  const hasStart = (l: string): boolean => (ctx.startCounts().get(l) ?? 0) > 0;
  const nextLetter = nextRequiredLetter(word, hasStart);
  z.requiredLetter = nextLetter;
  z.turnMs = decayTurnMs(z.turnMs);
  const opp = opponentOf(state, player.id);
  if (!opp) return;
  state.turn = opp.id;
  state.round = z.acceptedCount + 1;
  state.deadline = now + z.turnMs;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({ t: 'zincir_word', by: player.id, word, nextLetter, turnMs: z.turnMs });
  ctx.broadcastSnapshot(state);
}

// Sure doldu = BOMBA: sira sahibi 1 can kaybeder.
export async function onBoom(ctx: RoomCtx, state: RoomState): Promise<void> {
  const z = state.zincir;
  if (!z) return;
  const loser = state.turn;
  if (!loser) return;
  z.lives[loser] = Math.max(0, (z.lives[loser] ?? 0) - 1);

  if (z.lives[loser] <= 0) {
    const winner = opponentOf(state, loser);
    ctx.broadcast({ t: 'zincir_boom', loser, lives: z.lives, nextLetter: null });
    state.phase = 'match_end';
    state.winner = winner?.id ?? null;
    state.turn = null;
    state.deadline = null;
    state.alarmPurpose = null;
    await ctx.deleteAlarm();
    await ctx.save(state);
    if (winner) ctx.broadcast({ t: 'match_end', winner: winner.id, scores: ctx.scoresOf(state), word: z.lastWord });
    ctx.broadcastSnapshot(state);
    return;
  }

  // Taze guvenli harf, sira digerine gecer, sure tabana doner.
  const nextLetter = pickStartLetter(ctx);
  z.requiredLetter = nextLetter;
  z.turnMs = ZINCIR_START_MS;
  const other = opponentOf(state, loser);
  state.turn = other?.id ?? loser;
  state.deadline = Date.now() + z.turnMs;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({ t: 'zincir_boom', loser, lives: z.lives, nextLetter });
  ctx.broadcastSnapshot(state);
}

// Pas jokeri: sira ayni bas harfle rakibe gecer, mevcut turMs kadar TAM sure (kisalma yok).
export async function onJoker(ctx: RoomCtx, state: RoomState, player: PlayerState): Promise<void> {
  if (state.phase !== 'zincir_turn' || !state.zincir) return;
  if (state.turn !== player.id) return;
  if ((state.jokers[player.id] ?? 0) <= 0) return;
  const opp = opponentOf(state, player.id);
  if (!opp) return;
  state.jokers[player.id] = (state.jokers[player.id] ?? 0) - 1;
  state.turn = opp.id;
  state.deadline = Date.now() + state.zincir.turnMs;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({ t: 'joker_used', by: player.id, kind: 'pas' });
  ctx.broadcastSnapshot(state);
}
