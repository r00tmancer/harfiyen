import { useEffect, useRef } from 'react';
import { ZINCIR_LIVES } from '@harfiyen/shared';
import type { PlayerPublic, RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, useStore } from '../store';
import { leaveRoom, send } from '../net/ws';
import { Avatar } from '../ui/avatars';
import { MODE_META } from '../ui/modes';
import { Hearts, MedalDots, PLAYER_CSS, WinWash } from '../ui/parts';
import { staggerIn } from '../fx/anim';
import { paletteFor, rain } from '../fx/confetti';
import { up } from '../hooks';

// kupa: sun dolgulu, ink konturlu buyuk SVG
function Trophy({ size = 120 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="Kupa">
      <g stroke="var(--ink)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
        <path
          d="M28 14 h40 v22 a20 20 0 0 1-40 0 z"
          fill="var(--sun)"
        />
        <path
          d="M28 20 H16 a2 2 0 0 0-2 2 c0 10 6.5 16.5 14.5 18 M68 20 h12 a2 2 0 0 1 2 2 c0 10-6.5 16.5-14.5 18"
          fill="none"
        />
        <path d="M44 55 h8 v12 h-8 z" fill="var(--sun)" />
        <path d="M34 78 a14 8 0 0 1 28 0 z" fill="var(--sun)" />
        <path d="M30 67 h36 v11 h-36 z" fill="var(--grape)" />
      </g>
      {/* kupanin yuzu */}
      <circle cx={42} cy={30} r={2.6} fill="var(--ink)" />
      <circle cx={54} cy={30} r={2.6} fill="var(--ink)" />
      <path
        d="M42 37 Q48 42.5 54 37"
        fill="none"
        stroke="var(--ink)"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

// mac skoru moda gore: sayi raund kazanimi, digerleri puan
function finalScoreOf(snap: RoomSnapshot, p: PlayerPublic): number {
  if (snap.mode === 'sayi') return snap.sayi?.roundWins[p.id] ?? p.score;
  return p.score;
}

// oyuncu sutunu: buyuk sayi + moda ozel gosterge (madalya/kalp)
function PlayerScore({ snap, p, idx }: { snap: RoomSnapshot; p: PlayerPublic; idx: 0 | 1 }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Avatar
        index={p.avatar}
        color={PLAYER_CSS[idx].main}
        size={56}
        className={p.connected ? '' : 'grayed'}
      />
      <p className="font-display text-sm font-bold">{p.nick}</p>
      {snap.mode === 'zincir' ? (
        <Hearts lives={snap.zincir?.lives[p.id] ?? ZINCIR_LIVES} size={20} />
      ) : (
        <p className="font-display text-4xl font-extrabold" style={{ color: PLAYER_CSS[idx].dark }}>
          {finalScoreOf(snap, p)}
        </p>
      )}
      {snap.mode === 'sayi' && <MedalDots wins={snap.sayi?.roundWins[p.id] ?? 0} size={16} />}
    </div>
  );
}

// StrictMode cift calismasina karsi: her mac sonu kutlamasi bir kez
let celebratedSeq = -1;

export default function Victory() {
  const snapshot = useStore((s) => s.snapshot);
  const rematchWants = useStore((s) => s.rematchWants);
  const matchEndSeq = useStore((s) => s.matchEndSeq);
  const oppConnected = useStore((s) => s.oppConnected);
  const finalWord = useStore((s) => s.finalWord);
  const wordInfos = useStore((s) => s.wordInfos);
  const root = useRef<HTMLDivElement>(null);

  const winner = snapshot?.winner
    ? snapshot.players.find((p) => p.id === snapshot.winner)
    : undefined;
  const iWon = !!snapshot && snapshot.winner === snapshot.you;

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  useEffect(() => {
    // matchEndSeq 0 ise mac sonu mesaji bu oturumda gelmedi (sayfa yenileme) — kutlama yok
    if (!snapshot || !winner || matchEndSeq === 0 || matchEndSeq === celebratedSeq) return;
    celebratedSeq = matchEndSeq;
    rain(paletteFor(playerIndex(snapshot, winner.id)));
  }, [snapshot, winner, matchEndSeq]);

  if (!snapshot) return null;

  const me = meOf(snapshot);
  const opp = oppOf(snapshot);
  const myIdx = me ? playerIndex(snapshot, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const mineWant = rematchWants.includes(snapshot.you);
  const oppWants = !!opp && rematchWants.includes(opp.id);

  return (
    <div ref={root} className="flex w-full flex-col items-center gap-5 pt-8 pb-6 text-center">
      {/* kazanan renk yikamasi: ben -> mavi, rakip -> toz pembe */}
      {snapshot.winner && <WinWash mine={iWon} />}
      <div data-pop>
        <Trophy />
      </div>
      <h1 data-pop className="font-display text-4xl font-extrabold">
        {iWon ? 'Kazandın!' : winner ? `${winner.nick} kazandı` : 'Maç bitti'}
      </h1>

      <div data-pop className="chip chip-soft">
        {MODE_META[snapshot.mode].name}
      </div>

      <div data-pop className="card-candy flex w-full items-center justify-around gap-3">
        {me && <PlayerScore snap={snapshot} p={me} idx={myIdx} />}
        <span className="font-display text-xl font-extrabold" style={{ color: 'var(--ink-soft)' }}>
          -
        </span>
        {opp && <PlayerScore snap={snapshot} p={opp} idx={oppIdx} />}
      </div>

      {/* maci bitiren kelime + TDK anlami */}
      {finalWord && winner && (
        <div data-pop className="card-candy w-full p-4! text-center">
          <p className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            {iWon ? 'maçı bitiren kelimen' : `${winner.nick} bu kelimeyle bitirdi`}
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold" style={{ color: 'var(--ok)' }}>
            {up(finalWord)}
          </p>
          <p className="mt-2 text-[14px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            {wordInfos[finalWord] ?? 'TDK anlamı geliyor...'}
          </p>
        </div>
      )}

      {oppWants && !mineWant && (
        <div className="chip chip-sun" role="status">
          Rakip rövanş istiyor!
        </div>
      )}
      {!oppConnected && (
        <div className="chip chip-soft" role="status">
          Rakip ayrıldı
        </div>
      )}

      <div data-pop className="flex w-full flex-col gap-3">
        <button
          type="button"
          className="btn-candy btn-mint btn-lg btn-block"
          disabled={mineWant}
          onClick={() => {
            send({ t: 'rematch' });
          }}
        >
          {mineWant ? `Rövanş istendi (${rematchWants.length}/2)` : 'Rövanş'}
        </button>
        <button type="button" className="btn-candy btn-block" onClick={() => leaveRoom()}>
          Yeni oda
        </button>
      </div>
    </div>
  );
}
