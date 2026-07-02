import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { SUBMIT_THROTTLE_MS, UZUN_ROUND_MS } from '@harfiyen/shared';
import type { RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, REJECT_TEXT, useStore } from '../../store';
import { send } from '../../net/ws';
import { IconCrown, IconDoubleStar, IconSwap } from '../../ui/icons';
import { PLAYER_CSS, TimerBar, WinWash } from '../../ui/parts';
import { useRemaining, up } from '../../hooks';
import { dropIn, flipIn, popIn, staggerIn, wobble } from '../../fx/anim';
import { burst, paletteFor } from '../../fx/confetti';

// ---- tek gonderimlik uzun kelime yarisi ----
export function UzunRace({ snap }: { snap: RoomSnapshot }) {
  const myTries = useStore((s) => s.myUzunTries);
  const uzunExtra = useStore((s) => s.uzunExtra);
  const lastRejected = useStore((s) => s.lastRejected);
  const raceStartAt = useStore((s) => s.raceStartAt);

  const [word, setWord] = useState('');
  const [cooling, setCooling] = useState(false);
  const [errFlash, setErrFlash] = useState(false);

  const inputWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tileL = useRef<HTMLSpanElement>(null);
  const tileR = useRef<HTMLSpanElement>(null);
  const rejSeq = useRef(lastRejected?.seq ?? 0);

  const [l1, l2] = snap.letters ?? ['?', '?'];
  const me = meOf(snap);
  const opp = oppOf(snap);
  const jokers = me?.jokers ?? 0;
  const rem = useRemaining(snap.deadline);

  // kalan gonderim hakki (yerel sayim; throttled iadeleri store'da)
  const rights = Math.max(0, 1 + (uzunExtra ? 1 : 0) - myTries.length);
  const locked = rights === 0;
  const oppLocked = opp ? (snap.uzun?.submitted[opp.id] ?? false) : false;

  // kabul edilen = reddedilmemis deneme; en uzunu goster
  const myBest = myTries
    .filter((t) => !t.rejected)
    .reduce<string | null>((best, t) => (best === null || t.word.length > best.length ? t.word : best), null);

  useEffect(() => {
    if (Date.now() - raceStartAt < 1200) {
      dropIn(tileL.current, 0.05);
      dropIn(tileR.current, 0.18);
    }
  }, [raceStartAt]);

  useEffect(() => {
    if (!lastRejected || lastRejected.seq === rejSeq.current) return;
    rejSeq.current = lastRejected.seq;
    wobble(inputWrapRef.current);
    setErrFlash(true);
    const id = window.setTimeout(() => setErrFlash(false), 350);
    return () => window.clearTimeout(id);
  }, [lastRejected]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const w = word.trim();
    if (!w || cooling || locked) return;
    useStore.getState().uzunTryLocal(w);
    send({ t: 'submit_word', word: w });
    setWord('');
    setCooling(true);
    window.setTimeout(() => setCooling(false), SUBMIT_THROTTLE_MS);
  }

  return (
    <div className="flex flex-col gap-4">
      <TimerBar deadline={snap.deadline} total={UZUN_ROUND_MS} />
      <div className="flex justify-center">
        <span className="chip chip-soft font-display">{Math.ceil(rem / 1000)} sn</span>
      </div>

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

      {!locked ? (
        <>
          <div className="flex justify-center">
            <span className={`chip ${rights === 2 ? 'chip-sun' : 'chip-err'}`}>
              {rights === 2 ? 'İki hakkın var!' : 'Tek hakkın var!'}
            </span>
          </div>
          <form className="relative flex gap-2" onSubmit={submit}>
            <button
              type="button"
              className="btn-candy joker-btn shrink-0"
              disabled={jokers === 0 || uzunExtra}
              onClick={() => send({ t: 'use_joker' })}
              title="Çifte Şans jokeri"
              aria-label={`Çifte Şans jokeri: bu raund için ikinci gönderim hakkı (${jokers} hak)`}
            >
              <IconDoubleStar size={24} />
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
                placeholder={`${up(l1)} ile ${up(l2)} arası EN UZUN kelime`}
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
              className="btn-candy btn-grape shrink-0"
              disabled={cooling || word.trim().length === 0}
            >
              Kilitle
            </button>
          </form>
          {lastRejected && myTries.length > 0 && (
            <p
              key={lastRejected.seq}
              className="text-center text-[13px] font-bold"
              style={{ color: 'var(--err)' }}
              role="status"
            >
              {REJECT_TEXT[lastRejected.reason]}
              {rights > 0 ? ' — hâlâ bir hakkın var!' : ' — hakkın bitti'}
            </p>
          )}
        </>
      ) : (
        <LockedCard word={myBest} />
      )}

      {/* cifte sans alindiktan sonra da joker butonu kilitliyken kullanilabilsin */}
      {locked && jokers > 0 && !uzunExtra && (
        <button
          type="button"
          className="btn-candy btn-sun btn-block"
          onClick={() => send({ t: 'use_joker' })}
        >
          <IconDoubleStar size={20} />
          Çifte Şans: bir hak daha al
        </button>
      )}

      <div className="flex min-h-9 items-center justify-center gap-2">
        {oppLocked && <OppLockedBadge />}
      </div>
    </div>
  );
}

// kilitlenen kelimem: seker kartta gosterilir (rakibinki gizli)
function LockedCard({ word }: { word: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <div ref={ref} className="card-candy flex flex-col items-center gap-1 p-4! text-center">
      <p className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        {word ? 'Kelimen kilitlendi' : 'Hakkın bitti'}
      </p>
      {word ? (
        <p className="font-display text-3xl font-extrabold" style={{ color: 'var(--grape)' }}>
          {up(word)}
        </p>
      ) : (
        <p className="font-display text-xl font-extrabold" style={{ color: 'var(--err)' }}>
          Geçerli kelime yok
        </p>
      )}
      <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Süre bitince kelimeler açılıyor...
      </p>
    </div>
  );
}

function OppLockedBadge() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <span ref={ref} className="chip chip-p2">
      Rakip kilitledi
    </span>
  );
}

// ---- iki kart ayni anda acilir (round_end fazinda gosterilir) ----
export function UzunReveal({ snap }: { snap: RoomSnapshot }) {
  const reveal = useStore((s) => s.uzunReveal);
  const root = useRef<HTMLDivElement>(null);
  const myCard = useRef<HTMLDivElement>(null);
  const oppCard = useRef<HTMLDivElement>(null);
  const flippedSeq = useRef(0);

  const me = meOf(snap);
  const opp = oppOf(snap);
  const myIdx = me ? playerIndex(snap, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  useEffect(() => {
    if (!reveal || reveal.seq === flippedSeq.current) return;
    flippedSeq.current = reveal.seq;
    flipIn(myCard.current, 0.15);
    flipIn(oppCard.current, 0.15);
    if (reveal.winner) burst(paletteFor(playerIndex(snap, reveal.winner)));
  }, [reveal, snap]);

  if (!reveal) return null;

  const myWord = me ? reveal.words[me.id] : null;
  const oppWord = opp ? reveal.words[opp.id] : null;
  const iWon = reveal.winner === snap.you;
  const nobody = reveal.winner === null;

  function card(
    ref: React.RefObject<HTMLDivElement | null>,
    nick: string,
    idx: 0 | 1,
    w: { word: string; len: number } | null,
    winnerCard: boolean,
  ) {
    return (
      <div className="flip-wrap flex-1">
        <div
          ref={ref}
          className={`reveal-card card-candy flex flex-col items-center gap-1 p-3! text-center ${
            winnerCard ? 'win' : nobody ? '' : 'dim'
          }`}
          style={{ background: winnerCard ? PLAYER_CSS[idx].soft : 'var(--card)' }}
        >
          {winnerCard && (
            <span className="crown-badge" aria-label="Kazanan">
              <IconCrown size={22} />
            </span>
          )}
          <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            {nick}
          </p>
          {w ? (
            <>
              <p
                className={`font-display font-extrabold ${winnerCard ? 'text-2xl' : 'text-xl'}`}
                style={{ color: winnerCard ? PLAYER_CSS[idx].dark : 'var(--ink)' }}
              >
                {up(w.word)}
              </p>
              <span className="chip chip-soft">{w.len} harf</span>
            </>
          ) : (
            <p className="font-display text-lg font-extrabold" style={{ color: 'var(--ink-soft)' }}>
              Kelime yok
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col items-center gap-4 pt-4 text-center">
      {reveal.winner && <WinWash mine={iWon} />}
      <h2 data-pop className="font-display text-2xl font-extrabold">
        {nobody ? 'Kimse bulamadı' : iWon ? 'En uzun kelime senin!' : 'Rakibinki daha uzun'}
      </h2>

      <div data-pop className="flex w-full items-stretch gap-3">
        {me && card(myCard, 'sen', myIdx, myWord ?? null, !nobody && iWon)}
        {opp && card(oppCard, opp.nick, oppIdx, oppWord ?? null, !nobody && reveal.winner === opp.id)}
      </div>

      <p data-pop className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Yeni raunt geliyor...
      </p>
    </div>
  );
}
