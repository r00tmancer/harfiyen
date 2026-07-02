import { useEffect, useRef, useState } from 'react';
import { BOM_START_MS, SUBMIT_THROTTLE_MS } from '@harfiyen/shared';
import type { RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, useStore } from '../../store';
import { send } from '../../net/ws';
import { IconBurst, IconShield } from '../../ui/icons';
import { TimerBar } from '../../ui/parts';
import { useRemaining } from '../../hooks';
import { popIn } from '../../fx/anim';
import { burst, paletteFor } from '../../fx/confetti';

// kisa omurlu sonuc rozeti (sigorta kurtardi / sure doldu / yanlis hamle)
function BomNotice({ text, kind }: { text: string; kind: 'err' | 'save' }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <span ref={ref} className={`chip ${kind === 'save' ? 'chip-ok' : 'chip-err'}`} role="status">
      {kind === 'save' && <IconShield size={15} />}
      {text}
    </span>
  );
}

export function BomTurn({ snap }: { snap: RoomSnapshot }) {
  const lastBom = useStore((s) => s.lastBom);

  const [cooling, setCooling] = useState(false);
  const [ghost, setGhost] = useState<{ value: number; key: number } | null>(null); // ucup giden eski sayi
  const [splash, setSplash] = useState<number | null>(null); // BOM! patlama yazisi
  const [notice, setNotice] = useState<{ text: string; kind: 'err' | 'save'; key: number } | null>(
    null,
  );

  const numRef = useRef<HTMLSpanElement>(null);
  const seqRef = useRef(lastBom?.seq ?? 0);

  const me = meOf(snap);
  const opp = oppOf(snap);
  const myTurn = snap.turn === snap.you;
  const jokers = me?.jokers ?? 0;
  const b = snap.bom;
  const current = b?.current ?? 1;
  const insuredMe = b?.insured[snap.you] ?? false;

  const total = b?.turnMs ?? BOM_START_MS;
  const rem = useRemaining(snap.deadline);

  // bom_result: seq artisi animasyonlari tam bir kez tetikler
  useEffect(() => {
    if (!lastBom || lastBom.seq === seqRef.current) return;
    seqRef.current = lastBom.seq;
    const mine = lastBom.by === snap.you;
    if (lastBom.ok) {
      if (lastBom.kind === 'number') {
        // eski sayi yukari ucar, yenisi ziplayarak gelir
        setGhost({ value: lastBom.value, key: lastBom.seq });
        window.setTimeout(() => setGhost(null), 700);
      } else {
        // dogru BOM: yazi patlar + mini konfeti
        setSplash(lastBom.seq);
        burst(paletteFor(playerIndex(snap, lastBom.by)));
        window.setTimeout(() => setSplash(null), 1000);
      }
      popIn(numRef.current);
    } else if (lastBom.insured) {
      setNotice({
        text: mine ? 'Sigorta seni kurtardı!' : 'Sigorta rakibi kurtardı!',
        kind: 'save',
        key: lastBom.seq,
      });
      window.setTimeout(() => setNotice(null), 1800);
    } else {
      const text =
        lastBom.kind === 'timeout'
          ? mine
            ? 'Süre doldu!'
            : 'Rakibin süresi doldu!'
          : mine
            ? 'Yanlış hamle!'
            : 'Rakip yanlış bastı!';
      setNotice({ text, kind: 'err', key: lastBom.seq });
      window.setTimeout(() => setNotice(null), 1800);
    }
  }, [lastBom, snap]);

  function press(kind: 'number' | 'bom') {
    if (!myTurn || cooling) return;
    send({ t: 'bom_press', kind });
    setCooling(true);
    window.setTimeout(() => setCooling(false), SUBMIT_THROTTLE_MS);
  }

  const disabled = !myTurn || cooling;

  return (
    <div className="flex flex-col gap-4">
      <TimerBar deadline={snap.deadline} total={total} />

      <div className="flex items-center justify-center gap-2">
        <span className={`chip font-display text-base ${myTurn ? 'chip-sun' : 'chip-soft'}`}>
          {myTurn ? 'Sıra sende!' : `Sırada: ${opp?.nick ?? 'rakip'}`}
        </span>
        <span className="chip chip-soft font-display" aria-live="polite">
          {Math.ceil(rem / 1000)} sn
        </span>
      </div>

      {/* sahne: dev sayi tasi */}
      <div className="bom-stage">
        {ghost && (
          <span key={ghost.key} className="bom-ghost" aria-hidden="true">
            {ghost.value}
          </span>
        )}
        {splash !== null && (
          <span key={splash} className="bom-splash" aria-hidden="true">
            BOM!
          </span>
        )}
        <span ref={numRef} className="bom-number" aria-live="polite">
          {current}
        </span>
      </div>

      <p className="text-center text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        7&#39;nin katı ya da içinde 7 geçen sayıda BOM de, yoksa sayıya bas!
      </p>

      {/* iki dev buton: sayi / BOM */}
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          className="btn-candy bom-btn"
          disabled={disabled}
          onClick={() => press('number')}
          aria-label={`Sayıyı söyle: ${current}`}
        >
          {current}
        </button>
        <button
          type="button"
          className="btn-candy bom-btn bom-btn-boom"
          disabled={disabled}
          onClick={() => press('bom')}
          aria-label="BOM de"
        >
          <span className="bom-spark" aria-hidden="true">
            <IconBurst size={30} />
          </span>
          BOM!
        </button>
      </div>

      {/* sigorta jokeri + durum rozetleri */}
      <div className="flex min-h-14 items-center justify-center gap-2">
        <button
          type="button"
          className="btn-candy joker-btn shrink-0"
          disabled={jokers === 0 || insuredMe}
          onClick={() => send({ t: 'use_joker' })}
          title="Sigorta jokeri"
          aria-label={`Sigorta jokeri: bir hatayı affeder (${jokers} hak)`}
        >
          <IconShield size={24} />
          <span className="joker-count" aria-hidden="true">
            {jokers}
          </span>
        </button>
        {insuredMe && (
          <span className="chip chip-ok" role="status">
            <IconShield size={15} />
            Sigortalısın
          </span>
        )}
        {notice && <BomNotice key={notice.key} text={notice.text} kind={notice.kind} />}
      </div>
    </div>
  );
}
