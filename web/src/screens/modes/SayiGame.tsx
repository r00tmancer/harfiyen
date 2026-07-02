import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { SAYI_MAX, SAYI_MIN, SAYI_PICK_MS, SAYI_TURN_MS } from '@harfiyen/shared';
import type { RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, useStore } from '../../store';
import type { GuessResult } from '../../store';
import { send } from '../../net/ws';
import { Avatar } from '../../ui/avatars';
import { IconArrowDown, IconArrowUp, IconCheck, IconThermometer } from '../../ui/icons';
import { MedalDots, PLAYER_CSS, TimerBar, WaitingDots, WinWash } from '../../ui/parts';
import { useRemaining } from '../../hooks';
import { nudgeY, popIn, staggerIn, wobble } from '../../fx/anim';
import { burst, paletteFor } from '../../fx/confetti';

// termometre banti gorunumleri
const BAND: Record<string, { label: string; level: number; color: string }> = {
  kayniyor: { label: 'Kaynıyor!', level: 1, color: 'var(--err)' },
  sicak: { label: 'Sıcak', level: 0.72, color: 'var(--sun)' },
  ilik: { label: 'Ilık', level: 0.45, color: 'var(--mint)' },
  soguk: { label: 'Soğuk', level: 0.2, color: 'var(--p2)' },
};

function isBand(r: GuessResult): boolean {
  return r === 'kayniyor' || r === 'sicak' || r === 'ilik' || r === 'soguk';
}

// dolum seviyeli mini termometre
function ThermoGauge({ band, size = 26 }: { band: string; size?: number }) {
  const meta = BAND[band] ?? BAND.soguk;
  const fullH = 12;
  const h = fullH * meta.level;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M10 4.2a2.4 2.4 0 0 1 4.8 0v9a4.4 4.4 0 1 1-4.8 0z"
        fill="var(--card)"
        stroke="var(--ink)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx="12.4" cy="16.6" r="2.4" fill={meta.color} />
      <rect x="11.4" y={15 - h} width="2" height={h + 1.5} rx="1" fill={meta.color} />
    </svg>
  );
}

// ---- gizli sayi secimi ----
export function SayiPick({ snap }: { snap: RoomSnapshot }) {
  const [raw, setRaw] = useState('50');
  const [sent, setSent] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const rem = useRemaining(snap.deadline);

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  const value = Math.min(SAYI_MAX, Math.max(SAYI_MIN, Number(raw || '0')));
  const locked = sent || (snap.sayi?.myPicked ?? false);
  const oppPicked = snap.sayi?.oppPicked ?? false;

  function tapDigit(d: string) {
    if (locked) return;
    setRaw((r) => {
      let next = r === '0' ? d : r + d;
      if (next.length > 3 || Number(next) > SAYI_MAX) next = d;
      return next;
    });
  }

  function lock() {
    if (locked || raw === '' || Number(raw) < SAYI_MIN) return;
    send({ t: 'pick_number', value });
    setSent(true);
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      <div data-pop className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold">Gizli sayını seç</h2>
        <span className="chip chip-sun font-display text-base" aria-live="polite">
          {Math.ceil(rem / 1000)} sn
        </span>
      </div>
      <div data-pop>
        <TimerBar deadline={snap.deadline} total={SAYI_PICK_MS} />
      </div>

      <div data-pop className="flex justify-center py-1">
        <span className="tile tile-sun" style={{ width: 110, fontSize: 44 }}>
          {raw === '' ? '?' : value}
        </span>
      </div>

      <div data-pop className="px-1">
        <input
          type="range"
          className="slider-candy"
          min={SAYI_MIN}
          max={SAYI_MAX}
          value={value}
          disabled={locked}
          aria-label="Gizli sayı"
          onChange={(e) => setRaw(e.target.value)}
        />
      </div>

      <div data-pop className="flex flex-wrap justify-center gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
          <button
            key={d}
            type="button"
            className="letter-key"
            disabled={locked}
            onClick={() => tapDigit(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="letter-key"
          style={{ width: 74, fontSize: 15 }}
          disabled={locked || raw === ''}
          onClick={() => setRaw((r) => r.slice(0, -1))}
        >
          Sil
        </button>
      </div>

      <div data-pop>
        <button
          type="button"
          className="btn-candy btn-mint btn-lg btn-block"
          disabled={locked || raw === ''}
          onClick={lock}
        >
          {locked ? 'Sayın kilitlendi' : 'Kilitle'}
        </button>
      </div>

      <div className="flex min-h-9 items-center justify-center gap-2">
        {locked && <span className="chip chip-ok">Kilitlendi</span>}
        {oppPicked && <span className="chip chip-p2">Rakip seçti</span>}
      </div>
      <p className="text-center text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Rakibin, senin sayını bulmaya çalışacak. 1 ile 100 arasında seç.
      </p>
    </div>
  );
}

// kucuk aralik seridi: (lo, hi) araligini gosterir, tahminle daralir
function RangeBar({ lo, hi, idx }: { lo: number; hi: number; idx: 0 | 1 }) {
  const span = SAYI_MAX - SAYI_MIN + 2; // 0..101
  const left = (lo / span) * 100;
  const width = Math.max(2, ((hi - lo) / span) * 100);
  return (
    <div className="range-track">
      <div
        className="range-known"
        style={{ left: `${left}%`, width: `${width}%`, background: PLAYER_CSS[idx].main }}
      />
    </div>
  );
}

// ---- tahmin sirasi ----
export function SayiTurn({ snap }: { snap: RoomSnapshot }) {
  const guessLog = useStore((s) => s.guessLog);
  const lastGuess = useStore((s) => s.lastGuess);
  const thermoArmedBy = useStore((s) => s.thermoArmedBy);

  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(lastGuess?.seq ?? 0);

  const me = meOf(snap);
  const opp = oppOf(snap);
  const myIdx = me ? playerIndex(snap, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const myTurn = snap.turn === snap.you;
  const jokers = me?.jokers ?? 0;
  const armed = thermoArmedBy === snap.you;

  const myBounds = snap.sayi?.bounds[snap.you] ?? { lo: 0, hi: SAYI_MAX + 1 };
  const oppBounds = (opp && snap.sayi?.bounds[opp.id]) || { lo: 0, hi: SAYI_MAX + 1 };

  // tahmin sonucu: ok ziplar / termometre pop / buldu konfeti
  useEffect(() => {
    if (!lastGuess || lastGuess.seq === seqRef.current) return;
    seqRef.current = lastGuess.seq;
    if (lastGuess.result === 'buldu') {
      burst(paletteFor(playerIndex(snap, lastGuess.by)));
    } else if (lastGuess.result === 'yukari') {
      nudgeY(resultRef.current, 14);
    } else if (lastGuess.result === 'asagi') {
      nudgeY(resultRef.current, -14);
    } else {
      popIn(resultRef.current);
    }
    if (lastGuess.by === snap.you) {
      setRaw('');
      inputRef.current?.focus();
    }
  }, [lastGuess, snap]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = Number(raw);
    if (!myTurn || !Number.isInteger(v) || v < SAYI_MIN || v > SAYI_MAX) {
      wobble(inputWrapRef.current);
      return;
    }
    send({ t: 'guess', value: v });
  }

  return (
    <div className="flex flex-col gap-4">
      <TimerBar deadline={snap.deadline} total={SAYI_TURN_MS} />

      {snap.sayi?.equalizer && (
        <div className="flex justify-center">
          <span className="chip chip-sun">Eşitleme tahmini!</span>
        </div>
      )}

      {/* yildiz: daralan aralik */}
      <div className="card-candy flex flex-col gap-2 p-4!">
        <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
          Rakibin sayısı bu aralıkta
        </p>
        <RangeBar lo={myBounds.lo} hi={myBounds.hi} idx={myIdx} />
        <p className="font-display text-center text-3xl font-extrabold">
          {myBounds.lo} {'<'} <span style={{ color: PLAYER_CSS[myIdx].dark }}>x</span> {'<'}{' '}
          {myBounds.hi}
        </p>
      </div>

      {/* son sonuc */}
      {lastGuess && lastGuess.result !== 'buldu' && (
        <div ref={resultRef} className="flex items-center justify-center gap-2" aria-live="polite">
          <span className="chip chip-soft font-display text-base">{lastGuess.value}</span>
          {isBand(lastGuess.result) ? (
            <span className="chip" style={{ background: 'var(--card)' }}>
              <ThermoGauge band={lastGuess.result} size={22} />
              <b>{BAND[lastGuess.result]?.label}</b>
            </span>
          ) : lastGuess.result === 'yukari' ? (
            <span className="chip chip-ok">
              <IconArrowUp size={16} /> Daha yukarı
            </span>
          ) : (
            <span className="chip chip-err">
              <IconArrowDown size={16} /> Daha aşağı
            </span>
          )}
        </div>
      )}

      {myTurn ? (
        <form className="flex gap-2" onSubmit={submit}>
          <button
            type="button"
            className="btn-candy joker-btn shrink-0"
            disabled={jokers === 0 || armed}
            onClick={() => send({ t: 'use_joker' })}
            title="Termometre jokeri"
            aria-label={`Termometre jokeri: sıradaki tahminin mesafe ipucu verir (${jokers} hak)`}
          >
            <IconThermometer size={24} />
            <span className="joker-count" aria-hidden="true">
              {jokers}
            </span>
          </button>
          <div ref={inputWrapRef} className="min-w-0 flex-1">
            <input
              ref={inputRef}
              className="input-candy"
              type="number"
              inputMode="numeric"
              min={SAYI_MIN}
              max={SAYI_MAX}
              value={raw}
              placeholder="1-100 arası tahmin"
              enterKeyHint="send"
              onChange={(e) => setRaw(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-candy btn-p1 shrink-0" disabled={raw === ''}>
            Tahmin et!
          </button>
        </form>
      ) : (
        <div className="card-dashed flex flex-col items-center gap-3 py-5 text-center">
          <WaitingDots />
          <p className="font-display text-base font-bold" style={{ color: 'var(--ink-soft)' }}>
            Rakip düşünüyor...
          </p>
          <div className="flex w-full flex-col gap-1 px-3">
            <p className="text-[11px] font-bold" style={{ color: 'var(--ink-soft)' }}>
              Rakibin bildiği aralık: {oppBounds.lo} {'<'} x {'<'} {oppBounds.hi}
            </p>
            <RangeBar lo={oppBounds.lo} hi={oppBounds.hi} idx={oppIdx} />
          </div>
        </div>
      )}

      {armed && myTurn && (
        <div className="flex justify-center">
          <span className="chip chip-sun">
            <IconThermometer size={15} />
            Sıradaki tahminin termometreli
          </span>
        </div>
      )}

      {/* tahmin gecmisi */}
      {guessLog.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5" aria-live="polite">
          {[...guessLog].reverse().map((g) => (
            <span
              key={g.id}
              className="chip"
              style={{ background: PLAYER_CSS[playerIndex(snap, g.by)].soft }}
            >
              <b>{g.value}</b>
              {g.result === 'yukari' && <IconArrowUp size={13} />}
              {g.result === 'asagi' && <IconArrowDown size={13} />}
              {g.result === 'buldu' && <IconCheck size={13} />}
              {isBand(g.result) && (
                <span className="text-[11px]">{BAND[g.result]?.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- raund sonucu: iki gizli sayi da acilir ----
// Sunucu round_end sirasinda bounds'u tam sayiya cokertir (lo=gizli-1, hi=gizli+1);
// rakibin sayisi bounds[you].lo + 1 olarak turetilir.
export function SayiRoundEnd({ snap }: { snap: RoomSnapshot }) {
  const roundResult = useStore((s) => s.roundResult);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  const me = meOf(snap);
  const opp = oppOf(snap);
  const myIdx = me ? playerIndex(snap, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;

  const winner = roundResult?.winner
    ? snap.players.find((p) => p.id === roundResult.winner)
    : undefined;
  const wIdx = winner ? playerIndex(snap, winner.id) : 0;

  const myNumber = snap.sayi?.myNumber ?? null;
  const collapsed = snap.sayi?.bounds[snap.you];
  const oppNumber = collapsed && collapsed.hi - collapsed.lo === 2 ? collapsed.lo + 1 : null;

  return (
    <div ref={root} className="flex flex-col items-center gap-4 pt-4 text-center">
      {roundResult?.winner && <WinWash mine={roundResult.winner === snap.you} />}
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
          Berabere! İkiniz de buldunuz
        </h2>
      )}

      <div data-pop className="flex w-full items-stretch justify-center gap-3">
        <div className="card-candy flex flex-1 flex-col items-center gap-1 p-3!">
          <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            senin sayın
          </p>
          <span className="tile tile-sm" style={{ background: PLAYER_CSS[myIdx].soft }}>
            {myNumber ?? '?'}
          </span>
        </div>
        <div className="card-candy flex flex-1 flex-col items-center gap-1 p-3!">
          <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            {opp ? `${opp.nick}'in sayısı` : 'rakibin sayısı'}
          </p>
          <span className="tile tile-sm" style={{ background: PLAYER_CSS[oppIdx].soft }}>
            {oppNumber ?? '?'}
          </span>
        </div>
      </div>

      {/* raund madalyalari */}
      <div data-pop className="flex items-center gap-4">
        {me && <MedalDots wins={snap.sayi?.roundWins[me.id] ?? 0} size={20} />}
        <span className="font-display text-sm font-extrabold" style={{ color: 'var(--ink-soft)' }}>
          vs
        </span>
        {opp && <MedalDots wins={snap.sayi?.roundWins[opp.id] ?? 0} size={20} />}
      </div>

      <p data-pop className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Yeni raunt geliyor...
      </p>
    </div>
  );
}
