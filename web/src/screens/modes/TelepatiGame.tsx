import { useEffect, useRef } from 'react';
import { TELEPATI_ANSWER_MS, TELEPATI_QUESTIONS } from '@harfiyen/shared';
import type { PlayerPublic, RoomSnapshot } from '@harfiyen/shared';
import { meOf, oppOf, playerIndex, useStore } from '../../store';
import { send } from '../../net/ws';
import { Avatar } from '../../ui/avatars';
import { IconHeartsDuo, IconHeartSolid } from '../../ui/icons';
import { PLAYER_CSS, TimerBar } from '../../ui/parts';
import { useRemaining } from '../../hooks';
import { flipIn, popIn, snuggle, staggerIn } from '../../fx/anim';
import { heartBurst } from '../../fx/confetti';
import { haptics } from '../../fx/haptics';

// soru ilerleme noktalari: gecilenler pembe, aktif sari ve buyuk
export function QDots({ qIndex }: { qIndex: number }) {
  return (
    <div
      className="flex items-center justify-center gap-1.5"
      aria-label={`Soru ${qIndex}/${TELEPATI_QUESTIONS}`}
    >
      {Array.from({ length: TELEPATI_QUESTIONS }, (_, i) => (
        <span
          key={i}
          className={`q-dot ${i < qIndex - 1 ? 'done' : i === qIndex - 1 ? 'cur' : ''}`}
        />
      ))}
    </div>
  );
}

function OppAnsweredBadge() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    popIn(ref.current);
  }, []);
  return (
    <span ref={ref} className="chip chip-p2">
      O da cevapladı
    </span>
  );
}

// ---- soru fazi: iki oyuncu da gizlice cevapliyor ----
export function TelepatiSoru({ snap }: { snap: RoomSnapshot }) {
  const myChoice = useStore((s) => s.myTelepatiChoice);
  const root = useRef<HTMLDivElement>(null);
  const rem = useRemaining(snap.deadline);

  const t = snap.telepati;
  const me = meOf(snap);
  const opp = oppOf(snap);
  const myIdx = me ? playerIndex(snap, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;

  const answered = myChoice !== null || (t?.myAnswered ?? false);
  const oppAnswered = t?.oppAnswered ?? false;
  const doubled = t?.doubled ?? false;
  const jokers = me?.jokers ?? 0;

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  // soru degisince acilis animasyonu tekrar oynar
  const qKey = t?.qIndex ?? 0;
  const prevQ = useRef(qKey);
  useEffect(() => {
    if (prevQ.current !== qKey) {
      prevQ.current = qKey;
      staggerIn(root.current);
    }
  }, [qKey]);

  if (!t) return null;
  const q = t.question;

  function choose(choice: 'a' | 'b' | 'ben' | 'o') {
    if (answered) return;
    useStore.getState().telepatiAnswerLocal(choice);
    send({ t: 'telepati_answer', choice });
  }

  // secim butonu: kilitlenince secilen pembe kalir, digeri soluklasir
  function btnClass(choice: string): string {
    return `btn-candy telepati-btn ${myChoice === choice ? 'sel' : ''}`;
  }

  return (
    <div ref={root} className="flex flex-col gap-4">
      <div data-pop className="flex items-center justify-between">
        <QDots qIndex={t.qIndex} />
        <span className="chip chip-sun font-display text-base" aria-live="polite">
          {Math.ceil(rem / 1000)} sn
        </span>
      </div>
      <div data-pop>
        <TimerBar deadline={snap.deadline} total={TELEPATI_ANSWER_MS} />
      </div>

      {/* soru karti */}
      <div data-pop className="card-candy text-center">
        <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
          {q.type === 'kim' ? 'İkiniz de aynı kişiyi düşünün' : 'İkiniz de aynı şeyi seçin'}
        </p>
        <p className="mt-1 font-display text-[26px] leading-tight font-extrabold">{q.q}</p>
      </div>

      {/* dev cevap butonlari */}
      {q.type === 'ab' ? (
        <div data-pop className="flex items-stretch gap-3">
          <button
            type="button"
            className={btnClass('a')}
            disabled={answered}
            onClick={() => choose('a')}
          >
            {q.a ?? 'A'}
          </button>
          <button
            type="button"
            className={btnClass('b')}
            disabled={answered}
            onClick={() => choose('b')}
          >
            {q.b ?? 'B'}
          </button>
        </div>
      ) : (
        <div data-pop className="flex items-stretch gap-3">
          <button
            type="button"
            className={btnClass('ben')}
            disabled={answered}
            onClick={() => choose('ben')}
          >
            {me && <Avatar index={me.avatar} color={PLAYER_CSS[myIdx].main} size={44} />}
            Ben
          </button>
          <button
            type="button"
            className={btnClass('o')}
            disabled={answered}
            onClick={() => choose('o')}
          >
            {opp && <Avatar index={opp.avatar} color={PLAYER_CSS[oppIdx].main} size={44} />}
            {opp?.nick ?? 'O'}
          </button>
        </div>
      )}

      {/* durum rozetleri */}
      <div className="flex min-h-9 flex-wrap items-center justify-center gap-2">
        {answered && <span className="chip chip-ok">Cevabın kilitlendi</span>}
        {oppAnswered && <OppAnsweredBadge />}
      </div>

      {/* cifte kalp jokeri */}
      <div className="flex min-h-14 items-center justify-center gap-2">
        <button
          type="button"
          className="btn-candy joker-btn joker-love shrink-0"
          disabled={jokers === 0 || doubled}
          onClick={() => send({ t: 'use_joker' })}
          title="Çifte Kalp jokeri"
          aria-label={`Çifte Kalp jokeri: bu soru eşleşirse 2 puan (${jokers} hak)`}
        >
          <IconHeartsDuo size={24} />
          <span className="joker-count joker-count-love" aria-hidden="true">
            {jokers}
          </span>
        </button>
        {doubled && (
          <span className="chip pulse-love" role="status">
            <IconHeartSolid size={15} style={{ color: 'var(--p1)' }} />
            Bu soru 2 puan!
          </span>
        )}
      </div>

      <p className="text-center text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Cevabını gizlice ver — ikiniz aynı şeyi seçerseniz uyum puanı kazanırsınız.
      </p>
    </div>
  );
}

// kim tipinde isaret edilen oyuncu; ab tipinde sik metni
function answerView(
  snap: RoomSnapshot,
  qType: 'kim' | 'ab',
  raw: string | undefined,
): { text: string; target: PlayerPublic | null } {
  if (raw === undefined) return { text: 'Cevap yok', target: null };
  const t = snap.telepati;
  if (qType === 'ab') {
    const label = raw === 'a' ? t?.question.a : t?.question.b;
    return { text: label ?? raw.toUpperCase(), target: null };
  }
  const target = snap.players.find((p) => p.id === raw) ?? null;
  return { text: target?.nick ?? '?', target };
}

// ---- reveal fazi: cevaplar acilir, eslesme kutlanir ----
export function TelepatiReveal({ snap }: { snap: RoomSnapshot }) {
  const reveal = useStore((s) => s.telepatiReveal);
  const root = useRef<HTMLDivElement>(null);
  const myCard = useRef<HTMLDivElement>(null);
  const oppCard = useRef<HTMLDivElement>(null);
  const myAv = useRef<HTMLDivElement>(null);
  const oppAv = useRef<HTMLDivElement>(null);
  const heartRef = useRef<HTMLSpanElement>(null);
  const doneSeq = useRef(0);

  const me = meOf(snap);
  const opp = oppOf(snap);
  const myIdx = me ? playerIndex(snap, me.id) : 0;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const t = snap.telepati;

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  // seq artisi: flip + eslesmede kalp konfetisi + avatarlar sokulur
  useEffect(() => {
    if (!reveal || reveal.seq === doneSeq.current) return;
    doneSeq.current = reveal.seq;
    flipIn(myCard.current, 0.1);
    flipIn(oppCard.current, 0.1);
    if (reveal.match) {
      heartBurst();
      haptics.accept(); // uyum = kabul deseni
      snuggle(myAv.current, oppAv.current);
      popIn(heartRef.current, 0.3);
    }
  }, [reveal]);

  if (!t) return null;

  // sayfa yenilendiyse reveal mesaji elimizde yok: sade bekleme gorunumu
  if (!reveal) {
    return (
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <p className="font-display text-xl font-extrabold" style={{ color: 'var(--ink-soft)' }}>
          Cevaplar açılıyor...
        </p>
        <QDots qIndex={t.qIndex} />
      </div>
    );
  }

  const q = t.question;
  const myAns = me ? answerView(snap, q.type, reveal.answers[me.id]) : null;
  const oppAns = opp ? answerView(snap, q.type, reveal.answers[opp.id]) : null;

  function answerCard(
    ref: React.RefObject<HTMLDivElement | null>,
    owner: PlayerPublic,
    idx: 0 | 1,
    view: { text: string; target: PlayerPublic | null },
    ownerLabel: string,
  ) {
    const empty = view.text === 'Cevap yok';
    return (
      <div className="flip-wrap flex-1">
        <div
          ref={ref}
          className="reveal-card card-candy flex flex-col items-center gap-1.5 p-3! text-center"
          style={{ background: reveal!.match ? PLAYER_CSS[idx].soft : 'var(--card)' }}
        >
          <div className="flex items-center gap-1.5">
            <Avatar index={owner.avatar} color={PLAYER_CSS[idx].main} size={30} />
            <p className="text-[12px] font-bold" style={{ color: 'var(--ink-soft)' }}>
              {ownerLabel}
            </p>
          </div>
          {view.target ? (
            <div className="flex flex-col items-center gap-0.5">
              <Avatar
                index={view.target.avatar}
                color={PLAYER_CSS[playerIndex(snap, view.target.id)].main}
                size={44}
              />
              <p className="font-display text-lg leading-tight font-extrabold">{view.text}</p>
            </div>
          ) : (
            <p
              className={`font-display leading-tight font-extrabold ${empty ? 'text-base' : 'text-xl'}`}
              style={{ color: empty ? 'var(--ink-soft)' : 'var(--ink)' }}
            >
              {view.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className="flex flex-col items-center gap-4 pt-2 text-center">
      <QDots qIndex={reveal.qIndex} />

      {/* avatar sahnesi: eslesince birbirlerine sokulup ziplarlar */}
      <div className="telepati-stage" data-pop>
        {reveal.match && (
          <span className="uyum-splash" aria-hidden="true">
            UYUM!
          </span>
        )}
        <div className="flex items-center gap-3">
          <div ref={myAv}>
            {me && <Avatar index={me.avatar} color={PLAYER_CSS[myIdx].main} size={64} />}
          </div>
          <span
            ref={heartRef}
            className="inline-flex"
            style={{ color: reveal.match ? 'var(--p1)' : 'var(--ink-soft)', opacity: reveal.match ? 1 : 0.35 }}
            aria-hidden="true"
          >
            <IconHeartSolid size={30} />
          </span>
          <div ref={oppAv}>
            {opp && <Avatar index={opp.avatar} color={PLAYER_CSS[oppIdx].main} size={64} />}
          </div>
        </div>
      </div>

      <h2 data-pop className="font-display text-2xl font-extrabold" role="status">
        {reveal.match ? 'Aynı şeyi düşündünüz!' : 'Bu sefer tutmadı'}
      </h2>

      <p data-pop className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        {q.q}
      </p>

      <div data-pop className="flex w-full items-stretch gap-3">
        {me && myAns && answerCard(myCard, me, myIdx, myAns, 'sen')}
        {opp && oppAns && answerCard(oppCard, opp, oppIdx, oppAns, opp.nick)}
      </div>

      <div data-pop className="flex flex-wrap items-center justify-center gap-2">
        <span className="chip chip-p1 font-display text-base">
          <IconHeartSolid size={15} style={{ color: 'var(--p1-dark)' }} />
          {reveal.matches} uyum
        </span>
        {reveal.match && reveal.doubled && (
          <span className="chip pulse-love">
            <IconHeartsDuo size={15} />
            Çifte Kalp: +2!
          </span>
        )}
        {!reveal.match && (
          <span className="miss-sway chip chip-soft" aria-hidden="true">
            olsun...
          </span>
        )}
      </div>

      <p data-pop className="text-[13px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        {reveal.qIndex >= TELEPATI_QUESTIONS ? 'Sonuç geliyor...' : 'Yeni soru geliyor...'}
      </p>
    </div>
  );
}
