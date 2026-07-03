import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { REACTION_COUNT, REACTION_THROTTLE_MS } from '@harfiyen/shared';
import { useStore } from '../store';
import { send } from '../net/ws';
import { popIn, reducedMotion } from '../fx/anim';
import { haptics } from '../fx/haptics';
import { useRemaining } from '../hooks';
import { IconSmile } from './icons';
import { Sticker, STICKER_NAMES } from './stickers';

const BALLOON_MS = 2500; // balonun ekranda kalma suresi

interface BalloonItem {
  key: number;
  id: number;
  mine: boolean; // benimki soldan, rakibinki sagdan yukselir (skor bari duzeni)
}

// tek balon: asagidan yukari suzulur, hafifce salinir, sonda erir
function Balloon({ item }: { item: BalloonItem }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // hareket azaltilmis: sabit gorunur, suresi dolunca kaldirilir
    if (reducedMotion() || !outer.current || !inner.current) return;
    const secs = BALLOON_MS / 1000;
    const rise = gsap.fromTo(
      outer.current,
      { y: 30, opacity: 0, scale: 0.5 },
      { y: -180, opacity: 1, scale: 1, duration: secs, ease: 'power1.out' },
    );
    const fade = gsap.to(outer.current, {
      opacity: 0,
      duration: 0.45,
      delay: secs - 0.45,
      ease: 'power1.in',
    });
    const sway = gsap.to(inner.current, {
      x: 9,
      duration: 0.5,
      repeat: Math.ceil(secs / 0.5),
      yoyo: true,
      ease: 'sine.inOut',
    });
    return () => {
      rise.kill();
      fade.kill();
      sway.kill();
    };
  }, []);

  // ust uste gelen balonlar carpismasin diye minik dikey kaydirma
  const offset = (item.key % 3) * 18;
  return (
    <div
      ref={outer}
      className={`react-balloon ${item.mine ? 'mine' : 'opp'}`}
      style={{ bottom: 88 + offset }}
      aria-hidden="true"
    >
      <div ref={inner}>
        <Sticker id={item.id} size={58} />
      </div>
    </div>
  );
}

// 6'li sticker tepsisi (candy kart)
function Tray({ onPick }: { onPick: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <div ref={ref} className="react-tray" role="group" aria-label="Tepki seç">
      {Array.from({ length: REACTION_COUNT }, (_, i) => (
        <button
          key={i}
          type="button"
          className="react-pick"
          aria-label={STICKER_NAMES[i]}
          onClick={() => onPick(i)}
        >
          <Sticker id={i} size={46} />
        </button>
      ))}
    </div>
  );
}

// oda ekranlarinda (lobi/oyun/zafer) sag altta yuzen tepki butonu + balon katmani
export default function Reactions() {
  const lastReaction = useStore((s) => s.lastReaction);
  const [open, setOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);
  const seenSeq = useRef(lastReaction?.seq ?? 0);
  const timers = useRef<number[]>([]);

  // gelen tepki: balon kuyruguna ekle; rakiptense minik titresim
  useEffect(() => {
    if (!lastReaction || lastReaction.seq === seenSeq.current) return;
    seenSeq.current = lastReaction.seq;
    const you = useStore.getState().snapshot?.you ?? null;
    const mine = lastReaction.by === you;
    if (!mine) haptics.reaction();
    const key = lastReaction.seq;
    setBalloons((b) => [...b.slice(-5), { key, id: lastReaction.id, mine }]);
    timers.current.push(
      window.setTimeout(() => {
        setBalloons((b) => b.filter((x) => x.key !== key));
      }, BALLOON_MS + 200),
    );
  }, [lastReaction]);

  // ayrilirken bekleyen kaldirma zamanlayicilarini temizle
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const cdRem = useRemaining(cooldownUntil > Date.now() ? cooldownUntil : null);
  const cooling = cdRem > 0;
  const secs = Math.ceil(cdRem / 1000);

  function pick(id: number) {
    if (cooling) return;
    send({ t: 'react', id });
    setCooldownUntil(Date.now() + REACTION_THROTTLE_MS);
    setOpen(false);
  }

  return (
    <>
      {balloons.map((b) => (
        <Balloon key={b.key} item={b} />
      ))}
      {open && (
        <>
          {/* disina tiklayinca tepsi kapanir */}
          <button
            type="button"
            className="react-backdrop"
            aria-label="Tepki tepsisini kapat"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <Tray onPick={pick} />
        </>
      )}
      <button
        type="button"
        className="react-fab"
        disabled={cooling}
        aria-label={cooling ? `Yeni tepki için ${secs} saniye bekle` : 'Tepki gönder'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconSmile size={28} />
        {cooling && (
          <span className="react-cd" aria-hidden="true">
            {secs}
          </span>
        )}
      </button>
    </>
  );
}
