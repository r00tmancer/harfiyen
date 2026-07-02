// En Uzun Kelime modu: harf gibi secim + countdown, sonra tek-atislik uzun kelime yarisi.
// Her oyuncunun 1 gonderim hakki (Cifte Sans jokeri +1). En uzun gecerli kelime kazanir.
import {
  RESULT_MS,
  SUBMIT_THROTTLE_MS,
  TR_LETTERS,
  UZUN_ROUND_MS,
  UZUN_TARGET,
  normalizeTr,
} from '@harfiyen/shared';
import { uzunWinner, validateWord } from '../logic';
import type { UzunEntry } from '../logic';
import type { PlayerState, RoomCtx, RoomState } from '../state';

function randomLetter(): string {
  return TR_LETTERS[Math.floor(Math.random() * TR_LETTERS.length)];
}

// Countdown bitti: harfler acilir, herkese 1 gonderim hakki verilir, yaris baslar.
export async function startRace(ctx: RoomCtx, state: RoomState): Promise<void> {
  const pending = state.pending ?? {
    letters: [randomLetter(), randomLetter()] as [string, string],
    rerolled: false,
  };
  state.letters = pending.letters;
  state.pending = null;
  const rights: Record<string, number> = {};
  const best: Record<string, UzunEntry | null> = {};
  const submitted: Record<string, boolean> = {};
  for (const p of state.players) {
    rights[p.id] = 1;
    best[p.id] = null;
    submitted[p.id] = false;
  }
  state.uzun = { rights, best, submitted };
  state.phase = 'uzun_race';
  state.deadline = Date.now() + UZUN_ROUND_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({ t: 'letters', letters: pending.letters, rerolled: pending.rerolled });
  ctx.broadcastSnapshot(state);
}

// Gonderim hakki, kelime gecerli olsun olmasin TUKENIR (yuksek riskli tek atis).
export async function onSubmit(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  ws: WebSocket,
  rawWord: string,
): Promise<void> {
  const attempt = normalizeTr(String(rawWord ?? ''));
  if (state.phase !== 'uzun_race' || !state.uzun || !state.letters) {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'too_late' });
    return;
  }
  const u = state.uzun;
  if ((u.rights[player.id] ?? 0) <= 0) {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'too_late' }); // hak yok
    return;
  }
  const now = Date.now();
  if (now - player.lastSubmitAt < SUBMIT_THROTTLE_MS) {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: 'throttled' });
    return;
  }
  player.lastSubmitAt = now;

  u.rights[player.id] = (u.rights[player.id] ?? 0) - 1; // hak her halukarda gider
  const verdict = validateWord(attempt, state.letters, new Set(state.usedWords), ctx.dict());
  if (verdict.ok) {
    const len = [...verdict.word].length;
    const prev = u.best[player.id];
    if (!prev || len > prev.len) u.best[player.id] = { word: verdict.word, len, at: now }; // en uzunu sakla
  } else {
    ctx.sendTo(ws, { t: 'word_rejected', word: attempt, reason: verdict.reason });
  }

  if ((u.rights[player.id] ?? 0) <= 0) {
    u.submitted[player.id] = true;
    ctx.broadcast({ t: 'uzun_locked', by: player.id });
  }

  const bothDone = state.players.every((p) => (u.rights[p.id] ?? 0) <= 0);
  if (bothDone) {
    await reveal(ctx, state);
    return;
  }
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// Cifte Sans jokeri: bu raunt +1 gonderim hakki.
export async function onJoker(ctx: RoomCtx, state: RoomState, player: PlayerState): Promise<void> {
  if (state.phase !== 'uzun_race' || !state.uzun) return;
  if ((state.jokers[player.id] ?? 0) <= 0) return;
  state.jokers[player.id] = (state.jokers[player.id] ?? 0) - 1;
  state.uzun.rights[player.id] = (state.uzun.rights[player.id] ?? 0) + 1;
  state.uzun.submitted[player.id] = false; // hak geldi, kilit acilir
  await ctx.save(state);
  ctx.broadcast({ t: 'joker_used', by: player.id, kind: 'cifte_sans' });
  ctx.broadcastSnapshot(state);
}

// Sure doldu -> acilim.
export async function onRaceDeadline(ctx: RoomCtx, state: RoomState): Promise<void> {
  await reveal(ctx, state);
}

async function reveal(ctx: RoomCtx, state: RoomState): Promise<void> {
  const u = state.uzun;
  if (!u) return;
  const entries: Record<string, UzunEntry | null> = {};
  for (const p of state.players) entries[p.id] = u.best[p.id] ?? null;
  const winnerPid = uzunWinner(entries);

  // Gecerli aciga cikan kelimeler bir daha kullanilamaz.
  for (const p of state.players) {
    const e = u.best[p.id];
    if (e && !state.usedWords.includes(e.word)) state.usedWords.push(e.word);
  }

  const words: Record<string, { word: string; len: number } | null> = {};
  for (const p of state.players) {
    const e = u.best[p.id];
    words[p.id] = e ? { word: e.word, len: e.len } : null;
  }

  let finalWord: string | null = null;
  if (winnerPid) {
    const winner = state.players.find((p) => p.id === winnerPid);
    if (winner) winner.score += 1;
    finalWord = u.best[winnerPid]?.word ?? null;
  }
  const scores = ctx.scoresOf(state);
  ctx.broadcast({ t: 'uzun_reveal', words, winner: winnerPid, scores });

  const champ = winnerPid ? state.players.find((p) => p.id === winnerPid) : undefined;
  if (champ && champ.score >= UZUN_TARGET) {
    state.phase = 'match_end';
    state.winner = champ.id;
    state.deadline = null;
    state.alarmPurpose = null;
    await ctx.deleteAlarm();
    await ctx.save(state);
    ctx.broadcast({ t: 'match_end', winner: champ.id, scores, word: finalWord });
    ctx.broadcastSnapshot(state);
    return;
  }

  // round_end penceresi = acilimin ekranda kalma suresi (letters gorunur kalir).
  state.phase = 'round_end';
  state.deadline = Date.now() + RESULT_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}
