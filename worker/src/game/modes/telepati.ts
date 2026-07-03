// Telepati (Uyum Testi) modu: ko-op cift oyunu — iki oyuncu ayni soruya GIZLICE cevap verir,
// cevaplar ayni seyi gosterirse ORTAK uyum puani artar. Kazanan yok: match_end.winner = null.
// Cifte kalp jokeri: soru basina en fazla bir kez; soru eslesirse 2 puan sayilir.
import {
  COUNTDOWN_MS,
  TELEPATI_ANSWER_MS,
  TELEPATI_QUESTIONS,
  TELEPATI_REVEAL_MS,
} from '@harfiyen/shared';
import type { TelepatiQuestion } from '@harfiyen/shared';
import type { PlayerState, RoomCtx, RoomState } from '../state';
import telepatiJson from '../../data/telepati.json';

// ---- Saf mantik (testler bunlari hedefler) ----

// Bilinmeyen bicimdeki soru verisini dogrulanmis bankaya cevirir; bozuk kayitlar atlanir.
export function toTelepatiBank(data: unknown): TelepatiQuestion[] {
  if (!Array.isArray(data)) return [];
  const out: TelepatiQuestion[] = [];
  for (const e of data) {
    if (!e || typeof e !== 'object') continue;
    const { type, q, a, b } = e as { type?: unknown; q?: unknown; a?: unknown; b?: unknown };
    if (typeof q !== 'string' || q.length === 0) continue;
    if (type === 'kim') out.push({ type: 'kim', q });
    else if (type === 'ab' && typeof a === 'string' && typeof b === 'string') out.push({ type: 'ab', q, a, b });
  }
  return out;
}

// Kismi Fisher-Yates: bankadan count adet BENZERSIZ eleman (her mac/rovans taze alt kume).
export function pickQuestions<T>(bank: readonly T[], count: number, rand: () => number): T[] {
  const idx = bank.map((_, i) => i);
  const n = Math.max(0, Math.min(count, idx.length));
  for (let i = 0; i < n; i++) {
    const r = i + Math.floor(rand() * (idx.length - i));
    const j = Math.min(idx.length - 1, Math.max(i, r)); // rand() sinir degerlerinde bile guvenli
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx.slice(0, n).map((i) => bank[i]);
}

// 'kim' cevabi hedef pid'e cozulur: 'ben' = cevaplayanin kendisi, 'o' = rakibi.
export function resolveKimTarget(choice: 'ben' | 'o', self: string, opp: string): string {
  return choice === 'ben' ? self : opp;
}

// Secim, sorunun tipine uygun mu? (ab -> 'a'|'b', kim -> 'ben'|'o')
export function isValidChoice(type: TelepatiQuestion['type'], choice: string): boolean {
  return type === 'ab' ? choice === 'a' || choice === 'b' : choice === 'ben' || choice === 'o';
}

export interface TelepatiVerdict {
  match: boolean;
  answers: Record<string, string>; // reveal icin: ab -> 'a'|'b'; kim -> isaret edilen OYUNCUNUN pid'i
}

// Eslesme: ab -> ikisi de ayni sik; kim -> cozulen hedef pid'ler ESIT.
// (biri 'ben' digeri 'o' derse ayni kisiyi gosterebilir ve ESLESIR; ikisi de 'ben' derse eslesmez!)
// Cevaplamayan oyuncunun anahtari answers'ta hic yer almaz ve eslesme olusamaz.
export function telepatiEvaluate(
  type: TelepatiQuestion['type'],
  raw: Readonly<Record<string, string>>,
  pids: readonly [string, string],
): TelepatiVerdict {
  const [pa, pb] = pids;
  const answers: Record<string, string> = {};
  for (const pid of pids) {
    const choice = raw[pid];
    if (choice === undefined) continue;
    if (type === 'kim') {
      answers[pid] = resolveKimTarget(choice === 'ben' ? 'ben' : 'o', pid, pid === pa ? pb : pa);
    } else {
      answers[pid] = choice;
    }
  }
  const va = answers[pa];
  const vb = answers[pb];
  return { match: va !== undefined && vb !== undefined && va === vb, answers };
}

// Eslesen soru: cifte kalp aktifse 2, degilse 1 puan; eslesmezse 0.
export function telepatiDelta(match: boolean, doubled: boolean): number {
  return match ? (doubled ? 2 : 1) : 0;
}

// ---- Sunucu akisi ----

// Banka izolat basina bir kez dogrulanir.
let bankCache: TelepatiQuestion[] | null = null;
function getBank(): TelepatiQuestion[] {
  bankCache ??= toTelepatiBank(telepatiJson);
  return bankCache;
}

function currentQuestion(state: RoomState): TelepatiQuestion | undefined {
  const t = state.telepati;
  return t ? t.questions[t.qIndex - 1] : undefined;
}

// Bu macin toplam soru sayisi (banka kucukse alt kume de kucuk olabilir).
function totalQuestions(state: RoomState): number {
  return Math.min(TELEPATI_QUESTIONS, state.telepati?.questions.length ?? 0);
}

// Mac basi (ilk kez / rovans): TAZE rastgele soru alt kumesi, puan sifir, 3-2-1 geri sayim.
export async function startMatch(ctx: RoomCtx, state: RoomState): Promise<void> {
  state.telepati = {
    questions: pickQuestions(getBank(), TELEPATI_QUESTIONS, Math.random),
    qIndex: 1,
    answers: {},
    matches: 0,
    doubled: false,
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

// Geri sayim bitti / reveal sonrasi: siradaki soru acilir, cevaplar ve cifte kalp sifirlanir.
export async function startQuestion(ctx: RoomCtx, state: RoomState): Promise<void> {
  const t = state.telepati;
  if (!t) return;
  t.answers = {};
  t.doubled = false;
  state.round = t.qIndex; // round = qIndex
  state.turn = null;
  state.phase = 'telepati_soru';
  state.deadline = Date.now() + TELEPATI_ANSWER_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcastSnapshot(state);
}

// telepati_answer: yalniz telepati_soru fazinda, soru tipine uygun secim; ILK cevap kilitler.
export async function onAnswer(
  ctx: RoomCtx,
  state: RoomState,
  player: PlayerState,
  choice: string,
): Promise<void> {
  if (state.phase !== 'telepati_soru' || !state.telepati) return;
  const t = state.telepati;
  const q = currentQuestion(state);
  if (!q) return;
  if (!isValidChoice(q.type, String(choice ?? ''))) return;
  if (t.answers[player.id] !== undefined) return; // yeniden cevap yutulur
  t.answers[player.id] = choice;
  if (state.players.length === 2 && state.players.every((p) => t.answers[p.id] !== undefined)) {
    await reveal(ctx, state);
    return;
  }
  await ctx.save(state);
  ctx.broadcastSnapshot(state); // rakip oppAnswered bayragini gorsun (secim sizmaz)
}

// telepati_soru suresi doldu: eldeki cevaplarla degerlendir (cevapsiz = eslesme yok).
export async function onAnswerDeadline(ctx: RoomCtx, state: RoomState): Promise<void> {
  if (!state.telepati) return;
  await reveal(ctx, state);
}

// Cifte kalp jokeri: telepati_soru sirasinda, hak varsa; ayni soruda ikinci kullanim yutulur.
export async function onJoker(ctx: RoomCtx, state: RoomState, player: PlayerState): Promise<void> {
  if (state.phase !== 'telepati_soru' || !state.telepati) return;
  if ((state.jokers[player.id] ?? 0) <= 0) return;
  if (state.telepati.doubled) return; // bu soruda zaten aktif
  state.jokers[player.id] = (state.jokers[player.id] ?? 0) - 1;
  state.telepati.doubled = true;
  await ctx.save(state);
  ctx.broadcast({ t: 'joker_used', by: player.id, kind: 'cifte_kalp' });
  ctx.broadcastSnapshot(state);
}

// Cevaplar acilir: eslesme degerlendirilir, ortak puan islenir, reveal fazina gecilir.
async function reveal(ctx: RoomCtx, state: RoomState): Promise<void> {
  const t = state.telepati;
  const q = currentQuestion(state);
  if (!t || !q) return;
  const [p1, p2] = state.players;
  if (!p1 || !p2) return;
  const verdict = telepatiEvaluate(q.type, t.answers, [p1.id, p2.id]);
  t.matches += telepatiDelta(verdict.match, t.doubled);
  for (const p of state.players) p.score = t.matches; // skor gostergesi ortak puani yansitir
  state.phase = 'telepati_reveal';
  state.deadline = Date.now() + TELEPATI_REVEAL_MS;
  state.alarmPurpose = 'phase';
  await ctx.setAlarm(state.deadline);
  await ctx.save(state);
  ctx.broadcast({
    t: 'telepati_reveal',
    match: verdict.match,
    answers: verdict.answers,
    matches: t.matches,
    doubled: t.doubled,
    qIndex: t.qIndex,
  });
  ctx.broadcastSnapshot(state);
}

// Reveal suresi doldu: son soruysa mac biter (kazanan YOK), degilse siradaki soru.
export async function onRevealDone(ctx: RoomCtx, state: RoomState): Promise<void> {
  const t = state.telepati;
  if (!t) return;
  if (t.qIndex >= totalQuestions(state)) {
    state.phase = 'match_end';
    state.winner = null; // ko-op: kazanan yok, iki pid de ayni ortak puani alir
    state.turn = null;
    state.deadline = null;
    state.alarmPurpose = null;
    await ctx.deleteAlarm();
    await ctx.save(state);
    ctx.broadcast({ t: 'match_end', winner: null, scores: ctx.scoresOf(state), word: null });
    ctx.broadcastSnapshot(state);
    return;
  }
  t.qIndex += 1;
  await startQuestion(ctx, state);
}
