import { useEffect, useRef } from 'react';
import { meOf, oppOf, playerIndex, useStore } from '../store';
import { leaveRoom, send } from '../net/ws';
import { Avatar } from '../ui/avatars';
import { PLAYER_CSS } from '../ui/parts';
import { staggerIn } from '../fx/anim';
import { fanfare, pop } from '../fx/sfx';
import { paletteFor, rain } from '../fx/confetti';

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

// StrictMode cift calismasina karsi: her mac sonu kutlamasi bir kez
let celebratedSeq = -1;

export default function Victory() {
  const snapshot = useStore((s) => s.snapshot);
  const rematchWants = useStore((s) => s.rematchWants);
  const matchEndSeq = useStore((s) => s.matchEndSeq);
  const oppConnected = useStore((s) => s.oppConnected);
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
    fanfare();
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
      <div data-pop>
        <Trophy />
      </div>
      <h1 data-pop className="font-display text-4xl font-extrabold">
        {iWon ? 'Kazandın!' : winner ? `${winner.nick} kazandı` : 'Maç bitti'}
      </h1>

      <div data-pop className="card-candy flex w-full items-center justify-around gap-3">
        {me && (
          <div className="flex flex-col items-center gap-1">
            <Avatar index={me.avatar} color={PLAYER_CSS[myIdx].main} size={56} />
            <p className="font-display text-sm font-bold">{me.nick}</p>
            <p className="font-display text-4xl font-extrabold" style={{ color: PLAYER_CSS[myIdx].dark }}>
              {me.score}
            </p>
          </div>
        )}
        <span className="font-display text-xl font-extrabold" style={{ color: 'var(--ink-soft)' }}>
          -
        </span>
        {opp && (
          <div className="flex flex-col items-center gap-1">
            <Avatar
              index={opp.avatar}
              color={PLAYER_CSS[oppIdx].main}
              size={56}
              className={opp.connected ? '' : 'grayed'}
            />
            <p className="font-display text-sm font-bold">{opp.nick}</p>
            <p className="font-display text-4xl font-extrabold" style={{ color: PLAYER_CSS[oppIdx].dark }}>
              {opp.score}
            </p>
          </div>
        )}
      </div>

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
            pop();
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
