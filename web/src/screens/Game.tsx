import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  PICK_MS,
  RACE_MS,
  SUBMIT_THROTTLE_MS,
  TR_LETTERS,
} from '@harfiyen/shared';
import type { RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, REJECT_TEXT, useStore } from '../store';
import { send } from '../net/ws';
import { Avatar } from '../ui/avatars';
import { IconSwap } from '../ui/icons';
import { PLAYER_CSS, Stars, TimerBar } from '../ui/parts';
import { useRemaining, up } from '../hooks';
import { acceptPunch, dropIn, popIn, punchIn, reducedMotion, staggerIn, wobble } from '../fx/anim';
import { buzz, pop, tick } from '../fx/sfx';
import { burst, paletteFor } from '../fx/confetti';

// ---- ust skor bari ----
function ScoreBar({ snap }: { snap: RoomSnapshot }) {
  const oppRejectedSeq = useStore((s) => s.oppRejectedSeq);
  const me = meOf(snap);
  const opp = oppOf(snap);
  const myIdx = me ? playerIndex(snap, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const oppRef = useRef<HTMLDivElement>(null);
  const prevRej = useRef(oppRejectedSeq);

  // rakip denedi-tutmadi: avatarinda minik sallanma
  useEffect(() => {
    if (oppRejectedSeq > prevRej.current) wobble(oppRef.current);
    prevRej.current = oppRejectedSeq;
  }, [oppRejectedSeq]);

  return (
    <div className="flex items-stretch justify-between gap-2">
      {me && (
        <div
          className="flex flex-1 items-center gap-2 rounded-2xl border-[3px] px-2.5 py-2"
          style={{ borderColor: 'var(--ink)', background: PLAYER_CSS[myIdx].soft, boxShadow: '0 4px 0 var(--shadow-ink)' }}
        >
          <Avatar index={me.avatar} color={PLAYER_CSS[myIdx].main} size={38} />
          <div className="min-w-0">
            <p className="font-display truncate text-[13px] font-bold leading-tight">{me.nick}</p>
            <Stars score={me.score} size={17} />
          </div>
        </div>
      )}
      <div className="font-display grid place-items-center text-lg font-extrabold" style={{ color: 'var(--ink-soft)' }}>
        vs
      </div>
      {opp ? (
        <div
          ref={oppRef}
          className="flex flex-1 items-center justify-end gap-2 rounded-2xl border-[3px] px-2.5 py-2"
          style={{ borderColor: 'var(--ink)', background: PLAYER_CSS[oppIdx].soft, boxShadow: '0 4px 0 var(--shadow-ink)' }}
        >
          <div className="min-w-0 text-right">
            <p className="font-display truncate text-[13px] font-bold leading-tight">{opp.nick}</p>
            <div className="flex justify-end">
              <Stars score={opp.score} size={17} />
            </div>
          </div>
          <Avatar
            index={opp.avatar}
            color={PLAYER_CSS[oppIdx].main}
            size={38}
            className={opp.connected ? '' : 'grayed'}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}

// ---- harf secimi ----
function Picking({ snap }: { snap: RoomSnapshot }) {
  const myLetter = useStore((s) => s.myLetter);
  const root = useRef<HTMLDivElement>(null);
  const rem = useRemaining(snap.deadline);
  const me = meOf(snap);
  const opp = oppOf(snap);
  const locked = myLetter !== null || (me?.pickedLetter ?? false);

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  function choose(letter: string) {
    if (locked) return;
    useStore.getState().pickLetterLocal(letter);
    pop();
    send({ t: 'pick_letter', letter });
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      <div data-pop className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold">Harfini seç!</h2>
        <span className="chip chip-sun font-display text-base" aria-live="polite">
          {Math.ceil(rem / 1000)} sn
        </span>
      </div>
      <div data-pop>
        <TimerBar deadline={snap.deadline} total={PICK_MS} />
      </div>
      <div data-pop className="flex flex-wrap justify-center gap-2">
        {TR_LETTERS.map((l) => (
          <button
            key={l}
            type="button"
            className={`letter-key ${myLetter === l ? 'sel' : ''}`}
            disabled={locked && myLetter !== l}
            onClick={() => choose(l)}
          >
            {up(l)}
          </button>
        ))}
      </div>
      <div className="flex min-h-9 items-center justify-center gap-2">
        {locked && <span className="chip chip-ok">Harfin kilitlendi</span>}
        {opp?.pickedLetter && <OppPickedBadge />}
      </div>
      <p className="text-center text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Kelime, seçilen iki harften biriyle başlayıp diğeriyle bitecek.
      </p>
    </div>
  );
}

function OppPickedBadge() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <span ref={ref} className="chip chip-p2">
      Rakip seçti
    </span>
  );
}

// ---- 3-2-1 geri sayim ----
function CountdownOverlay({ deadline }: { deadline: number | null }) {
  const rem = useRemaining(deadline);
  const n = Math.min(3, Math.max(1, Math.ceil(rem / 1000)));
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(-1);

  useEffect(() => {
    if (prev.current !== n) {
      prev.current = n;
      tick();
      punchIn(ref.current);
    }
  }, [n]);

  const colors = ['var(--p1)', 'var(--p2)', 'var(--grape)'];
  return (
    <div className="overlay" role="status" aria-live="assertive">
      <div ref={ref} className="count-num" style={{ color: colors[(n - 1) % 3] }}>
        {n}
      </div>
    </div>
  );
}

// ---- kelime yarisi ----
function Racing({ snap }: { snap: RoomSnapshot }) {
  const lastAccepted = useStore((s) => s.lastAccepted);
  const lastRejected = useStore((s) => s.lastRejected);
  const attempts = useStore((s) => s.attempts);
  const lettersRerolled = useStore((s) => s.lettersRerolled);
  const raceStartAt = useStore((s) => s.raceStartAt);

  const [word, setWord] = useState('');
  const [cooling, setCooling] = useState(false);
  const [showStart, setShowStart] = useState(() => Date.now() - raceStartAt < 1200);

  const inputWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tileL = useRef<HTMLSpanElement>(null);
  const tileR = useRef<HTMLSpanElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const accSeq = useRef(lastAccepted?.seq ?? 0);
  const rejSeq = useRef(lastRejected?.seq ?? 0);

  const [l1, l2] = snap.letters ?? ['?', '?'];

  // taslar yukaridan dusup seker (reroll'da da tekrar)
  useEffect(() => {
    if (Date.now() - raceStartAt < 1200) {
      dropIn(tileL.current, 0.05);
      dropIn(tileR.current, 0.18);
    }
  }, [raceStartAt]);

  // BASLA! yazisi patlayip kaybolur
  useEffect(() => {
    if (!showStart) return;
    pop();
    if (!reducedMotion()) punchIn(startRef.current);
    const id = window.setTimeout(() => setShowStart(false), 850);
    return () => window.clearTimeout(id);
  }, [showStart]);

  // kabul: yesil pop + konfeti; benimse input temizlenir
  useEffect(() => {
    if (!lastAccepted || lastAccepted.seq === accSeq.current) return;
    accSeq.current = lastAccepted.seq;
    pop();
    burst(paletteFor(playerIndex(snap, lastAccepted.by)));
    if (lastAccepted.by === snap.you) {
      setWord('');
      acceptPunch(inputWrapRef.current);
      inputRef.current?.focus();
    }
  }, [lastAccepted, snap]);

  // red: wobble + kisa kirmizi kenarlik + buzz
  const [errFlash, setErrFlash] = useState(false);
  useEffect(() => {
    if (!lastRejected || lastRejected.seq === rejSeq.current) return;
    rejSeq.current = lastRejected.seq;
    buzz();
    wobble(inputWrapRef.current);
    setErrFlash(true);
    const id = window.setTimeout(() => setErrFlash(false), 350);
    inputRef.current?.focus();
    return () => window.clearTimeout(id);
  }, [lastRejected]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const w = word.trim();
    if (!w || cooling) return;
    send({ t: 'submit_word', word: w });
    setCooling(true);
    window.setTimeout(() => setCooling(false), SUBMIT_THROTTLE_MS);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      {showStart && (
        <div ref={startRef} className="start-flash" aria-hidden="true">
          BAŞLA!
        </div>
      )}

      <TimerBar deadline={snap.deadline} total={RACE_MS} />

      <div className="flex items-center justify-center gap-4 py-2">
        <span ref={tileL} className="tile tile-rot-l tile-p1">
          {up(l1)}
        </span>
        <span style={{ color: 'var(--ink-soft)' }}>
          <IconSwap size={30} />
        </span>
        <span ref={tileR} className="tile tile-rot-r tile-p2">
          {up(l2)}
        </span>
      </div>

      {lettersRerolled && (
        <div className="flex justify-center">
          <span className="chip chip-sun">Yeni harfler geldi!</span>
        </div>
      )}

      <form className="flex gap-2" onSubmit={submit}>
        <div ref={inputWrapRef} className="min-w-0 flex-1">
          <input
            ref={inputRef}
            className={`input-candy ${errFlash ? 'input-err' : ''}`}
            type="text"
            value={word}
            placeholder={`${up(l1)} ile ${up(l2)} arasında bir kelime`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            lang="tr"
            onChange={(e) => setWord(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn-candy btn-p1 shrink-0"
          disabled={cooling || word.trim().length === 0}
        >
          Gönder
        </button>
      </form>

      <ul className="flex flex-col-reverse gap-2" aria-live="polite">
        {attempts.map((a) => (
          <AttemptRow
            key={a.id}
            word={a.word}
            ok={a.ok}
            mine={a.mine}
            reason={a.reason ? REJECT_TEXT[a.reason] : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

function AttemptRow({
  word,
  ok,
  mine,
  reason,
}: {
  word: string;
  ok: boolean;
  mine: boolean;
  reason?: string;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <li ref={ref} className={`feed-item ${ok ? 'ok' : 'err'}`}>
      <span className="font-display truncate text-base font-bold">{up(word)}</span>
      <span className="shrink-0 text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        {ok ? (mine ? 'senin!' : 'rakibin') : reason}
      </span>
    </li>
  );
}

// ---- raund sonucu ----
function RoundEnd({ snap }: { snap: RoomSnapshot }) {
  const roundResult = useStore((s) => s.roundResult);
  const wordInfos = useStore((s) => s.wordInfos);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  const winner = roundResult?.winner
    ? snap.players.find((p) => p.id === roundResult.winner)
    : undefined;
  const wIdx = winner ? playerIndex(snap, winner.id) : 0;
  const word = roundResult?.word ?? null;
  const meaning = word ? wordInfos[word] : undefined;

  return (
    <div ref={root} className="flex flex-col items-center gap-4 pt-4 text-center">
      {winner ? (
        <>
          <div data-pop>
            <Avatar index={winner.avatar} color={PLAYER_CSS[wIdx].main} size={72} />
          </div>
          <h2 data-pop className="font-display text-2xl font-extrabold">
            {winner.id === snap.you ? 'Raundu kaptın!' : `Raundu ${winner.nick} kaptı`}
          </h2>
        </>
      ) : (
        <h2 data-pop className="font-display text-2xl font-extrabold">
          Süre doldu, kimse bulamadı
        </h2>
      )}

      {word && winner && (
        <div data-pop className="card-candy w-full p-4!">
          <p className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            {winner.id === snap.you ? 'yazdığın kelime' : `${winner.nick} bu kelimeyi yazdı`}
          </p>
          <p
            className="mt-1 font-display text-3xl font-extrabold"
            style={{ color: 'var(--ok)' }}
          >
            {up(word)}
          </p>
          <p className="mt-2 text-[14px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            {meaning ?? 'TDK anlamı geliyor...'}
          </p>
        </div>
      )}

      <p data-pop className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Yeni raunt geliyor...
      </p>
    </div>
  );
}

export default function Game() {
  const snapshot = useStore((s) => s.snapshot);
  if (!snapshot) return null;

  return (
    <div className="flex w-full flex-col gap-4 pt-3 pb-6">
      <ScoreBar snap={snapshot} />
      <div className="chip chip-soft self-center">Raunt {snapshot.round}</div>
      {snapshot.phase === 'picking' && <Picking snap={snapshot} />}
      {snapshot.phase === 'countdown' && <CountdownOverlay deadline={snapshot.deadline} />}
      {snapshot.phase === 'racing' && <Racing snap={snapshot} />}
      {snapshot.phase === 'round_end' && <RoundEnd snap={snapshot} />}
    </div>
  );
}
