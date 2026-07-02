import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { SUBMIT_THROTTLE_MS, ZINCIR_START_MS } from '@harfiyen/shared';
import type { RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, REJECT_TEXT, useStore } from '../../store';
import { send } from '../../net/ws';
import { IconPass } from '../../ui/icons';
import { PLAYER_CSS, WaitingDots } from '../../ui/parts';
import { useRemaining, up } from '../../hooks';
import { acceptPunch, popIn, wobble } from '../../fx/anim';

// sahne bombasi: yuvarlak govde + kapak; sicak sekerleme yuzu
function BombSvg({ size = 120 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Bomba">
      <g stroke="var(--ink)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
        <circle cx={48} cy={56} r={30} fill="var(--ink)" fillOpacity={0.88} />
        <path d="M40 24 h16 l-2 8 h-12 z" fill="var(--grape)" />
        <path d="M52 22 q3-8 12-9" fill="none" />
      </g>
      {/* kivilcim */}
      <g stroke="var(--sun)" strokeWidth={3.4} strokeLinecap="round">
        <path d="M66 9 l4-4M69 13.5l5 .8M64 6l-.6-5" />
      </g>
      {/* parlaklik + yuz */}
      <circle cx={37} cy={46} r={6.5} fill="#fff" opacity={0.28} />
      <circle cx={41} cy={58} r={2.8} fill="#fff" />
      <circle cx={56} cy={58} r={2.8} fill="#fff" />
      <path d="M42 67 Q48.5 63 55 67" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

// fitil seridi: kalan sureyle kisalir, ucunda kivilcim
function Fuse({ pct }: { pct: number }) {
  return (
    <div className="fuse-track" role="timer" aria-label="Kalan süre">
      <div className="fuse-fill" style={{ width: `${pct}%` }} />
      <span className="fuse-spark" style={{ left: `${pct}%` }} aria-hidden="true">
        <svg viewBox="0 0 20 20" width={20} height={20}>
          <path
            d="M10 1.5l2 4.5 4.8.6-3.6 3.3.9 4.9L10 12.4l-4.1 2.4.9-4.9L3.2 6.6 8 6z"
            fill="var(--sun)"
            stroke="var(--ink)"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

// son kelime: zincirin devam harfi renkli tasla vurgulanir
function LastWord({ word, nextLetter, idx }: { word: string; nextLetter: string | null; idx: 0 | 1 }) {
  // sunucunun verdigi nextLetter kelimenin icinde sondan aranir (g gibi atlanan harfler icin)
  let hl = word.length - 1;
  if (nextLetter) {
    const i = word.lastIndexOf(nextLetter);
    if (i >= 0) hl = i;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-1" aria-label={`Son kelime: ${word}`}>
      {word.split('').map((ch, i) => (
        <span
          key={i}
          className="zincir-letter"
          style={
            i === hl
              ? { background: 'var(--sun)', transform: 'rotate(-3deg) scale(1.12)' }
              : { background: PLAYER_CSS[idx].soft }
          }
        >
          {up(ch)}
        </span>
      ))}
    </div>
  );
}

export function ZincirTurn({ snap }: { snap: RoomSnapshot }) {
  const lastRejected = useStore((s) => s.lastRejected);
  const lastZincir = useStore((s) => s.lastZincir);

  const [word, setWord] = useState('');
  const [cooling, setCooling] = useState(false);
  const [errFlash, setErrFlash] = useState(false);

  const inputWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const rejSeq = useRef(lastRejected?.seq ?? 0);
  const zSeq = useRef(lastZincir?.seq ?? 0);

  const me = meOf(snap);
  const opp = oppOf(snap);
  const myTurn = snap.turn === snap.you;
  const jokers = me?.jokers ?? 0;
  const z = snap.zincir;

  const total = z?.turnMs ?? ZINCIR_START_MS;
  const rem = useRemaining(snap.deadline);
  const pct = Math.max(0, Math.min(100, (rem / total) * 100));
  const ticking = pct < 30 && rem > 0;

  // kabul edilen halka: kelime alani pop + input temizle
  useEffect(() => {
    if (!lastZincir || lastZincir.seq === zSeq.current) return;
    zSeq.current = lastZincir.seq;
    acceptPunch(wordRef.current);
    if (lastZincir.by === snap.you) setWord('');
    if (snap.turn === snap.you) inputRef.current?.focus();
  }, [lastZincir, snap]);

  // red: wobble + kirmizi flas, sure akmaya devam eder
  useEffect(() => {
    if (!lastRejected || lastRejected.seq === rejSeq.current) return;
    rejSeq.current = lastRejected.seq;
    wobble(inputWrapRef.current);
    setErrFlash(true);
    const id = window.setTimeout(() => setErrFlash(false), 350);
    inputRef.current?.focus();
    return () => window.clearTimeout(id);
  }, [lastRejected]);

  // sira bana gelince odaklan
  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const w = word.trim();
    if (!w || cooling || !myTurn) return;
    send({ t: 'submit_word', word: w });
    setCooling(true);
    window.setTimeout(() => setCooling(false), SUBMIT_THROTTLE_MS);
    inputRef.current?.focus();
  }

  const byIdx: 0 | 1 = lastZincir ? playerIndex(snap, lastZincir.by) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* bomba + fitil */}
      <div className="flex flex-col items-center gap-1">
        <div className={`bomb-wrap ${ticking ? 'ticking' : ''}`}>
          <BombSvg size={110} />
        </div>
        <div className="w-full px-2">
          <Fuse pct={pct} />
        </div>
        <span className="chip chip-soft font-display" aria-live="polite">
          {Math.ceil(rem / 1000)} sn
        </span>
      </div>

      {/* harf gorevi */}
      <div className="flex items-center justify-center gap-2">
        <span className="chip chip-sun font-display text-base">
          Harfin: {z?.requiredLetter ? up(z.requiredLetter) : '?'}
        </span>
        {!myTurn && (
          <span className="chip chip-soft">Sıra rakipte</span>
        )}
      </div>

      {/* son kelime */}
      <div ref={wordRef} className="min-h-12">
        {z?.lastWord ? (
          <LastWord word={z.lastWord} nextLetter={z.requiredLetter} idx={byIdx} />
        ) : (
          <p className="text-center text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            İlk kelimeyi {myTurn ? 'sen yazıyorsun' : 'rakip yazıyor'}. Zincir kopmasın!
          </p>
        )}
      </div>

      {myTurn ? (
        <form className="flex gap-2" onSubmit={submit}>
          <button
            type="button"
            className="btn-candy joker-btn shrink-0"
            disabled={jokers === 0}
            onClick={() => send({ t: 'use_joker' })}
            title="Pas jokeri"
            aria-label={`Pas jokeri: sırayı aynı harfle rakibe devret (${jokers} hak)`}
          >
            <IconPass size={24} />
            <span className="joker-count" aria-hidden="true">
              {jokers}
            </span>
          </button>
          <div ref={inputWrapRef} className="min-w-0 flex-1">
            <input
              ref={inputRef}
              className={`input-candy ${errFlash ? 'input-err' : ''}`}
              type="text"
              value={word}
              placeholder={
                z?.requiredLetter
                  ? `${up(z.requiredLetter)} ile başlayan kelime`
                  : 'Bir kelime yaz'
              }
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
      ) : (
        <div className="card-dashed flex items-center justify-center gap-3 py-4">
          <WaitingDots />
          <p className="font-display text-base font-bold" style={{ color: 'var(--ink-soft)' }}>
            {opp ? `${opp.nick} yazıyor...` : 'Rakip yazıyor...'}
          </p>
        </div>
      )}

      {lastRejected && myTurn && (
        <RejectHint key={lastRejected.seq} text={REJECT_TEXT[lastRejected.reason]} />
      )}
    </div>
  );
}

// kisa omurlu red mesaji (sure akarken bilgi verir)
function RejectHint({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <p
      ref={ref}
      className="text-center text-[13px] font-bold"
      style={{ color: 'var(--err)' }}
      role="status"
    >
      {text}
    </p>
  );
}
