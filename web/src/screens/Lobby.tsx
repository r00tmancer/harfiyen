import { useEffect, useRef, useState } from 'react';
import type { PlayerPublic } from '@harfiyen/shared';
import { meOf, oppOf, useStore } from '../store';
import { leaveRoom, send } from '../net/ws';
import { Avatar } from '../ui/avatars';
import { IconBack, IconCheck, IconCopy } from '../ui/icons';
import { CodeTiles, PLAYER_CSS, WaitingDots } from '../ui/parts';
import { staggerIn } from '../fx/anim';
import { pop } from '../fx/sfx';

function PlayerCard({ p, idx, you }: { p: PlayerPublic; idx: 0 | 1; you?: boolean }) {
  const pal = PLAYER_CSS[idx];
  return (
    <div
      className="card-candy flex flex-col items-center gap-2 p-4! text-center"
      style={{ background: pal.soft }}
    >
      <Avatar index={p.avatar} color={pal.main} size={56} className={p.connected ? '' : 'grayed'} />
      <div className="font-display text-base font-bold leading-tight">
        {p.nick}
        {you && (
          <span className="block text-[11px] font-bold" style={{ color: 'var(--ink-soft)' }}>
            (sen)
          </span>
        )}
      </div>
      {p.ready ? (
        <span className="chip chip-ok">Hazır</span>
      ) : (
        <span className="chip chip-soft">Bekliyor</span>
      )}
    </div>
  );
}

export default function Lobby() {
  const snapshot = useStore((s) => s.snapshot);
  const roomCode = useStore((s) => s.roomCode);
  const conn = useStore((s) => s.conn);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  const code = snapshot?.code ?? roomCode ?? '';
  const me = snapshot ? meOf(snapshot) : undefined;
  const opp = snapshot ? oppOf(snapshot) : undefined;
  const myIdx = snapshot && me ? (snapshot.players.indexOf(me) === 1 ? 1 : 0) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;

  async function copyLink() {
    const link = `${location.origin}${import.meta.env.BASE_URL}#/oda/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      pop();
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // pano izni yoksa en azindan adres cubugundaki hash zaten ayni linki tasir
      setCopied(false);
    }
  }

  return (
    <div ref={root} className="flex w-full flex-col gap-5 pt-4 pb-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn-candy icon-btn"
          aria-label="Odadan ayrıl"
          onClick={() => leaveRoom()}
        >
          <IconBack />
        </button>
        <h1 className="font-display text-2xl font-extrabold">Lobi</h1>
        <span className="w-12" aria-hidden="true" />
      </div>

      <div data-pop className="card-candy flex flex-col items-center gap-4 text-center">
        <p className="font-display text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>
          Oda kodu
        </p>
        <CodeTiles code={code} />
        <button
          type="button"
          className={`btn-candy btn-block ${copied ? 'btn-mint' : 'btn-sun'}`}
          onClick={() => void copyLink()}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? 'Kopyalandı' : 'Linki kopyala'}
        </button>
        <p className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
          Linki arkadaşına gönder, tek dokunuşla katılsın.
        </p>
      </div>

      <div data-pop className="grid grid-cols-2 gap-3">
        {me ? (
          <PlayerCard p={me} idx={myIdx} you />
        ) : (
          <div className="card-dashed flex flex-col items-center justify-center gap-3 text-center">
            <WaitingDots />
            <p className="font-display text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>
              Bağlanılıyor
            </p>
          </div>
        )}
        {opp ? (
          <PlayerCard p={opp} idx={oppIdx} />
        ) : (
          <div className="card-dashed flex flex-col items-center justify-center gap-3 text-center">
            <WaitingDots />
            <p className="font-display text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>
              Rakip bekleniyor
            </p>
          </div>
        )}
      </div>

      <div data-pop>
        <button
          type="button"
          className="btn-candy btn-mint btn-lg btn-block"
          disabled={!me || me.ready || conn !== 'open'}
          onClick={() => {
            pop();
            send({ t: 'ready' });
          }}
        >
          {me?.ready ? 'Hazırsın, rakip bekleniyor' : 'Hazırım'}
        </button>
      </div>
    </div>
  );
}
