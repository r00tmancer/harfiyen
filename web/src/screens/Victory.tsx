import { useEffect, useRef } from 'react';
import { BOM_LIVES, TELEPATI_QUESTIONS, ZINCIR_LIVES } from '@harfiyen/shared';
import type { PlayerPublic, RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, useStore } from '../store';
import { leaveRoom, send } from '../net/ws';
import { Avatar } from '../ui/avatars';
import { IconHeartSolid } from '../ui/icons';
import { MODE_META } from '../ui/modes';
import { Hearts, MedalDots, PLAYER_CSS, WinWash } from '../ui/parts';
import { staggerIn } from '../fx/anim';
import { heartRain, paletteFor, rain } from '../fx/confetti';
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

// zincir/bom: skorun yerine kalan can gosterilir
function livesOf(snap: RoomSnapshot, p: PlayerPublic): number | null {
  if (snap.mode === 'zincir') return snap.zincir?.lives[p.id] ?? ZINCIR_LIVES;
  if (snap.mode === 'bom') return snap.bom?.lives[p.id] ?? BOM_LIVES;
  return null;
}

// oyuncu sutunu: buyuk sayi + moda ozel gosterge (madalya/kalp)
function PlayerScore({ snap, p, idx }: { snap: RoomSnapshot; p: PlayerPublic; idx: 0 | 1 }) {
  const lives = livesOf(snap, p);
  return (
    <div className="flex flex-col items-center gap-1">
      <Avatar
        index={p.avatar}
        color={PLAYER_CSS[idx].main}
        size={56}
        className={p.connected ? '' : 'grayed'}
      />
      <p className="font-display text-sm font-bold">{p.nick}</p>
      {lives !== null ? (
        <Hearts lives={lives} size={20} max={snap.mode === 'bom' ? BOM_LIVES : ZINCIR_LIVES} />
      ) : (
        <p className="font-display text-4xl font-extrabold" style={{ color: PLAYER_CSS[idx].dark }}>
          {finalScoreOf(snap, p)}
        </p>
      )}
      {snap.mode === 'sayi' && <MedalDots wins={snap.sayi?.roundWins[p.id] ?? 0} size={16} />}
    </div>
  );
}

// telepati: ortak uyum yuzdesi ve maci bulunmayan ko-op sonucu
function isKoopTelepati(snap: RoomSnapshot): boolean {
  return snap.mode === 'telepati' && snap.winner === null && snap.phase === 'match_end';
}

// cifte kalple %100'u asabilir; asla kirpilmaz ('%110 uyum!' daha tatli)
function telepatiPct(snap: RoomSnapshot): number {
  const matches = snap.telepati?.matches ?? meOf(snap)?.score ?? 0;
  return Math.round((matches / TELEPATI_QUESTIONS) * 100);
}

function uyumTitle(pct: number): string {
  if (pct >= 90) return 'Ruh ikizisiniz!';
  if (pct >= 70) return 'Kalpler aynı atıyor';
  if (pct >= 50) return 'Fena değil, gelişiyorsunuz';
  return 'Zıt kutuplar çeker derler...';
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
    if (!snapshot || matchEndSeq === 0 || matchEndSeq === celebratedSeq) return;
    // ko-op telepati: kazanan yok, yuksek uyumda kalp yagmuru
    if (isKoopTelepati(snapshot)) {
      celebratedSeq = matchEndSeq;
      if (telepatiPct(snapshot) >= 70) heartRain();
      return;
    }
    if (!winner) return;
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

  // rovans/yeni oda + durum rozetleri: iki varyantta da ayni
  const footer = (
    <>
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
    </>
  );

  // ---- ko-op telepati: kazanan yok, ortak uyum sonucu ----
  if (isKoopTelepati(snapshot)) {
    const matches = snapshot.telepati?.matches ?? me?.score ?? 0;
    const pct = telepatiPct(snapshot);
    return (
      <div ref={root} className="flex w-full flex-col items-center gap-5 pt-8 pb-6 text-center">
        {/* pembe yikamasi: bu modda renk taraf degil sevgi belirtir */}
        <WinWash mine={false} />

        <div data-pop className="flex items-center gap-3">
          {me && <Avatar index={me.avatar} color={PLAYER_CSS[myIdx].main} size={64} />}
          <span className="inline-flex" style={{ color: 'var(--p1)' }} aria-hidden="true">
            <IconHeartSolid size={34} />
          </span>
          {opp && (
            <Avatar
              index={opp.avatar}
              color={PLAYER_CSS[oppIdx].main}
              size={64}
              className={opp.connected ? '' : 'grayed'}
            />
          )}
        </div>

        <h1 data-pop className="font-display text-4xl font-extrabold">
          Uyum Sonucu
        </h1>

        <div data-pop className="chip chip-soft">
          {MODE_META.telepati.name}
          {opp ? ` — ${me?.nick ?? ''} + ${opp.nick}` : ''}
        </div>

        <div data-pop className="card-candy w-full text-center">
          <p className="uyum-pct" aria-label={`Yüzde ${pct} uyum`}>
            %{pct}
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold" style={{ color: 'var(--p1-dark)' }}>
            {uyumTitle(pct)}
          </p>
          <p className="mt-3 flex items-center justify-center">
            <span className="chip chip-p1 font-display text-base">
              <IconHeartSolid size={15} style={{ color: 'var(--p1-dark)' }} />
              {matches} uyum · {TELEPATI_QUESTIONS} soru
            </span>
          </p>
        </div>

        {footer}
      </div>
    );
  }

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

      {footer}
    </div>
  );
}
