// Sayi Avi modu: gizli sayi secimi + sirayla tahmin + termometre jokeri + eşitleme adaleti.
import {
  RESULT_MS,
  SAYI_MAX,
  SAYI_MIN,
  SAYI_PICK_MS,
  SAYI_ROUNDS_TO_WIN,
  SAYI_TURN_MS,
  SUBMIT_THROTTLE_MS,
} from '@harfiyen/shared';
import { sayiBand, sayiCompare, sayiRoundDecision, updateBounds } from '../logic';
import type { PlayerState, RoomCtx, RoomState, SayiServer } from '../state';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function opponentOf(state: RoomState, pid: string): PlayerState | undefined {
  return state.players.find((p) => p.id !== pid);
}

// Bu raundun baslaticisi: 1. raundda yazi-tura, sonrakilerde bir onceki baslaticinin rakibi.
function pickStarter(state: RoomState, s: SayiServer): string {
  const [a, b] = state.players;
  if (!a || !b) return a?.id ?? b?.id ?? '';
  if (s.starter === null) return Math.random() < 0.5 ? a.id : b.id;
  return s.starter === a.id ? b.id : a.id;
}

// Mac basi (ilk kez / rovans): roundWins ve baslatici sifirlanir, sonra sayi_pick.
export async function startMatch(ctx: RoomCtx, state: RoomState): Promise<void> {
  const roundWins: Record<string, number> = {};
  for (const p of state.players) roundWins[p.id] = 0;
  state.sayi = {
    roundWins,
    secrets: {},
    picked: {},
    bounds: {},
    thermo: {},
    equalizer: false,
    starter: null,
  };
  await enterPick(ctx, state);
}

// Yeni raund: gizli sayilar/aralik sifirlanir; roundWins ve baslatici (alternatif icin) KORUNUR.
export async function nextRound(ctx: RoomCtx, state: RoomState): Promise<void> {
  await enterPick(ctx, state);
}

async function enterPick(ctx: RoomCtx, state: RoomState): Promise<void> {
  const s = state.sayi;
  if (!s) return;
  for (const p of state.players) {
    s.secrets[p.id] = null;
    s.picked[p.id] = false;
    s.bounds[p.id] = { lo: 0, hi: 101 }; // lo < x < hi
    s.thermo[p.id] = false;
    s.roundWins[p.id] ??= 0;
  }
  s.equalizer = false;
  const played = state.players.reduce((sum, p) => sum + (s.roundWins[p.id] ?? 0), 0);
  state.round = played + 1;
  state.turn = null;
  state.phase = 'sayi_pick';
  state.letters = null;
  state.pending = null;
  state.deadline = Date.now() + SAYI_PICK_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// pick_number: yalniz sayi_pick, tam sayi 1..100. Yeniden secim (son kilit gelmeden) serbest;
// ikinci oyuncu da secince tur hemen baslar (o andan sonra degistirilemez).
export async function onPickNumber(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  value: number,
): Promise<void> {
  if (state.phase !== 'sayi_pick' || !state.sayi) return;
  if (!Number.isInteger(value) || value < SAYI_MIN || value > SAYI_MAX) return;
  const s = state.sayi;
  s.secrets[player.id] = value; // son secim gecerli
  s.picked[player.id] = true;
  if (state.players.length === 2 && state.players.every((p) => s.picked[p.id])) {
    await startTurns(ctx, state);
    return;
  }
  await ctx.save(state);
  ctx.broadcastSnapshot(state); // rakip oppPicked'i gorsun
}

// sayi_pick suresi doldu: secmeyene rastgele sayi atanir, tur baslar.
export async function onPickDeadline(ctx: RoomCtx, state: RoomState): Promise<void> {
  const s = state.sayi;
  if (!s) return;
  for (const p of state.players) {
    if (s.secrets[p.id] == null) {
      s.secrets[p.id] = randInt(SAYI_MIN, SAYI_MAX);
      s.picked[p.id] = true;
    }
  }
  await startTurns(ctx, state);
}

async function startTurns(ctx: RoomCtx, state: RoomState): Promise<void> {
  const s = state.sayi;
  if (!s) return;
  s.starter = pickStarter(state, s);
  s.equalizer = false;
  state.turn = s.starter;
  state.phase = 'sayi_turn';
  state.deadline = Date.now() + SAYI_TURN_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// guess: yalniz sira sahibi, tam sayi 1..100. Aptal degerlere izin var (aralik zorunlu degil).
export async function onGuess(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  value: number,
): Promise<void> {
  if (state.phase !== 'sayi_turn' || !state.sayi) return;
  if (state.turn !== player.id) return;
  if (!Number.isInteger(value) || value < SAYI_MIN || value > SAYI_MAX) return;
  const now = Date.now();
  if (now - player.lastSubmitAt < SUBMIT_THROTTLE_MS) return; // guess'in red mesaji yok, sessizce yut
  player.lastSubmitAt = now;

  const s = state.sayi;
  const opp = opponentOf(state, player.id);
  if (!opp) return;
  const secret = s.secrets[opp.id];
  if (secret == null) return;
  const found = value === secret;
  const armed = s.thermo[player.id] === true;

  let result: 'yukari' | 'asagi' | 'buldu' | 'kayniyor' | 'sicak' | 'ilik' | 'soguk';
  let outBounds: { lo: number; hi: number } | null;
  if (armed) {
    result = sayiBand(value, secret); // tam isabet 'buldu', degilse mesafe bandi
    s.thermo[player.id] = false; // tek atislik
    outBounds = null; // termometrede aralik guncellenmez
  } else {
    const dir = sayiCompare(value, secret);
    result = dir;
    if (dir !== 'buldu') s.bounds[player.id] = updateBounds(s.bounds[player.id], value, dir);
    outBounds = s.bounds[player.id];
  }
  ctx.broadcast({ t: 'guess_result', by: player.id, value, result, bounds: outBounds });

  const dec = sayiRoundDecision({
    found,
    guesserIsStarter: player.id === s.starter,
    inEqualizer: s.equalizer,
  });

  if (dec.over) {
    let winnerPid: string | null;
    if (dec.result === 'tie') winnerPid = null;
    else if (dec.result === 'starter') winnerPid = s.starter;
    else winnerPid = player.id; // 'guesser'
    await endRound(ctx, state, winnerPid);
    return;
  }

  // Baslatici buldu: rakibe TEK eşitleme tahmini. Sira ona gecer, faz devam eder.
  if (dec.equalizer) {
    s.equalizer = true;
    state.turn = opp.id;
    state.deadline = now + SAYI_TURN_MS;
    state.alarmPurpose = 'phase';
    await ctx.setAlarm(state.deadline);
    await ctx.save(state);
    ctx.broadcastSnapshot(state);
    return;
  }

  // Devam: sira rakibe gecer.
  state.turn = opp.id;
  state.deadline = now + SAYI_TURN_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// sayi_turn suresi doldu: eşitleme asamasinda ise baslatici kazanir; degilse sira sessizce gecer.
export async function onTurnDeadline(ctx: RoomCtx, state: RoomState): Promise<void> {
  const s = state.sayi;
  if (!s) return;
  if (s.equalizer) {
    await endRound(ctx, state, s.starter);
    return;
  }
  const cur = state.turn;
  const opp = cur ? opponentOf(state, cur) : undefined;
  if (!opp) return;
  state.turn = opp.id;
  state.deadline = Date.now() + SAYI_TURN_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// Termometre jokeri: kendi sirasinda sonraki tahmini bant sonucuna cevirir.
export async function onJoker(ctx: RoomCtx, state: RoomState, player: PlayerState): Promise<void> {
  if (state.phase !== 'sayi_turn' || !state.sayi) return;
  if (state.turn !== player.id) return;
  if ((state.jokers[player.id] ?? 0) <= 0) return;
  if (state.sayi.thermo[player.id]) return; // zaten kurulu
  state.jokers[player.id] = (state.jokers[player.id] ?? 0) - 1;
  state.sayi.thermo[player.id] = true;
  await ctx.save(state);
  ctx.broadcast({ t: 'joker_used', by: player.id, kind: 'termometre' });
  ctx.broadcastSnapshot(state);
}

async function endRound(ctx: RoomCtx, state: RoomState, winnerPid: string | null): Promise<void> {
  const s = state.sayi;
  if (!s) return;
  if (winnerPid) s.roundWins[winnerPid] = (s.roundWins[winnerPid] ?? 0) + 1;

  // ACILIM: round_end'de her oyuncunun aralik kaydini tahmin ETTIGI (rakip) sayiya daraltiriz;
  // UI aciga cikan sayiyi lo+1 olarak turetir. Bu, ozel bir gizli-alan sizintisi degil kasitli acilimdir.
  for (const p of state.players) {
    const opp = opponentOf(state, p.id);
    if (!opp) continue;
    const sec = s.secrets[opp.id];
    if (sec == null) continue;
    s.bounds[p.id] = { lo: sec - 1, hi: sec + 1 };
  }
  // Skor gostergesi roundWins'i yansitir.
  for (const p of state.players) p.score = s.roundWins[p.id] ?? 0;
  const scores = ctx.scoresOf(state);

  if (winnerPid && (s.roundWins[winnerPid] ?? 0) >= SAYI_ROUNDS_TO_WIN) {
    state.phase = 'match_end';
    state.winner = winnerPid;
    state.turn = null;
    state.deadline = null;
    state.alarmPurpose = null;
    await ctx.deleteAlarm();
    await ctx.save(state);
    ctx.broadcast({ t: 'match_end', winner: winnerPid, scores, word: null });
    ctx.broadcastSnapshot(state);
    return;
  }

  state.phase = 'round_end';
  state.turn = null;
  state.deadline = Date.now() + RESULT_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({ t: 'round_end', winner: winnerPid, word: null, scores });
  ctx.broadcastSnapshot(state);
}
