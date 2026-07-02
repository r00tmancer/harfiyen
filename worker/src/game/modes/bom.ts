// 7 Bom modu: sirayla say; 7'nin katinda ya da icinde 7 gecen sayida BOM de. Sure gitgide kisalir,
// yanlis hamle ya da sure dolmasi can goturur. Sigorta jokeri bir sonraki hatayi affeder.
import { BOM_LIVES, BOM_START_MS, COUNTDOWN_MS, SUBMIT_THROTTLE_MS } from '@harfiyen/shared';
import { bomPress } from '../logic';
import type { PlayerState, RoomCtx, RoomState } from '../state';

function opponentOf(state: RoomState, pid: string): PlayerState | undefined {
  return state.players.find((p) => p.id !== pid);
}

// Mac basi (ilk kez / rovans): canlar dolar, sayac 1'e doner, sigortalar temizlenir, 3-2-1 geri sayim.
export async function startMatch(ctx: RoomCtx, state: RoomState): Promise<void> {
  const lives: Record<string, number> = {};
  const insured: Record<string, boolean> = {};
  for (const p of state.players) {
    lives[p.id] = BOM_LIVES;
    insured[p.id] = false;
  }
  state.bom = { lives, current: 1, turnMs: BOM_START_MS, insured };
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

// Geri sayim bitti: rastgele baslayan oyuncu, sayac 1, ilk tur suresi.
export async function startTurn(ctx: RoomCtx, state: RoomState): Promise<void> {
  const b = state.bom;
  if (!b) return;
  b.current = 1;
  b.turnMs = BOM_START_MS;
  const first = state.players[Math.floor(Math.random() * state.players.length)];
  state.turn = first?.id ?? null;
  state.phase = 'bom_turn';
  state.round = b.current;
  state.deadline = Date.now() + b.turnMs;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// Sira sahibinin basisi. Sira disi ya da faz disi basislar sessizce yutulur, cift-basma throttle'lanir.
export async function onPress(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  kind: 'number' | 'bom',
): Promise<void> {
  if (state.phase !== 'bom_turn' || !state.bom) return;
  if (state.turn !== player.id) return; // sira sende degil
  const now = Date.now();
  if (now - player.lastSubmitAt < SUBMIT_THROTTLE_MS) return; // hizli cift-basma
  player.lastSubmitAt = now;
  await resolvePress(ctx, state, player, kind, now);
}

// Alarm caldi = sure doldu: sira sahibi 'timeout' ile yanlis yapmis sayilir.
export async function onTimeout(ctx: RoomCtx, state: RoomState): Promise<void> {
  if (!state.bom) return;
  const pid = state.turn;
  if (!pid) return;
  const player = state.players.find((p) => p.id === pid);
  if (!player) return;
  await resolvePress(ctx, state, player, 'timeout', Date.now());
}

// Basis/timeout sonucunu isler: sonuc yayini, can/sigorta/sayi guncelleme, sira devri veya mac sonu.
async function resolvePress(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  kind: 'number' | 'bom' | 'timeout',
  now: number,
): Promise<void> {
  const b = state.bom;
  if (!b) return;
  const value = b.current; // basilan andaki sayi (yayinda 'value' bu)
  const outcome = bomPress({
    current: value,
    kind,
    insured: b.insured[player.id] ?? false,
    lives: b.lives[player.id] ?? 0,
    turnMs: b.turnMs,
  });

  if (outcome.insuredUsed) b.insured[player.id] = false; // sigorta tuketilir
  b.lives[player.id] = outcome.livesAfter;
  b.current = outcome.next;
  b.turnMs = outcome.turnMs;

  const opp = opponentOf(state, player.id);
  ctx.broadcast({
    t: 'bom_result',
    by: player.id,
    value,
    kind,
    ok: outcome.ok,
    insured: outcome.insuredUsed,
    lives: b.lives,
    next: outcome.next,
    turnMs: outcome.turnMs,
  });

  // Son can gitti: mac biter, rakip kazanir.
  if (outcome.matchEnd) {
    state.phase = 'match_end';
    state.winner = opp?.id ?? null;
    state.turn = null;
    state.deadline = null;
    state.alarmPurpose = null;
    await ctx.deleteAlarm();
    await ctx.save(state);
    if (opp) ctx.broadcast({ t: 'match_end', winner: opp.id, scores: ctx.scoresOf(state), word: null });
    ctx.broadcastSnapshot(state);
    return;
  }

  // Devam: sira rakibe gecer, yeni deadline.
  state.turn = opp?.id ?? player.id;
  state.round = b.current;
  state.deadline = now + b.turnMs;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// Sigorta jokeri: bom_turn boyunca (sira sart degil), hak varsa ve zaten sigortali degilse.
export async function onJoker(ctx: RoomCtx, state: RoomState, player: PlayerState): Promise<void> {
  if (state.phase !== 'bom_turn' || !state.bom) return;
  if ((state.jokers[player.id] ?? 0) <= 0) return;
  if (state.bom.insured[player.id]) return; // zaten sigortali
  state.jokers[player.id] = (state.jokers[player.id] ?? 0) - 1;
  state.bom.insured[player.id] = true;
  await ctx.save(state);
  ctx.broadcast({ t: 'joker_used', by: player.id, kind: 'sigorta' });
  ctx.broadcastSnapshot(state);
}
