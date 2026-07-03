import { useEffect, useRef, useState } from 'react';
import { AVATAR_COUNT, MAX_NICK_LEN } from '@harfiyen/shared';
import { useStore } from '../store';
import { apiCheckRoom, apiCreateRoom, connect } from '../net/ws';
import { Avatar, AVATAR_NAMES, AVATAR_PICK_COLORS } from '../ui/avatars';
import { staggerIn, dropIn } from '../fx/anim';
import { haptics, hapticsEnabled, setHapticsEnabled } from '../fx/haptics';

const LOGO = ['H', 'A', 'R', 'F', 'İ', 'Y', 'E', 'N'];
const LOGO_COLORS = [
  'var(--p1)',
  'var(--p2)',
  'var(--sun)',
  'var(--mint)',
  'var(--grape)',
  'var(--p1)',
  'var(--p2)',
  'var(--sun)',
];

function Logo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    Array.from(ref.current.children).forEach((el, i) => dropIn(el, 0.08 * i));
  }, []);
  return (
    <div ref={ref} className="flex justify-center gap-1.5" aria-label="Harfiyen">
      {LOGO.map((ch, i) => (
        <span
          key={i}
          className="logo-tile"
          style={{
            background: LOGO_COLORS[i],
            transform: `rotate(${i % 2 === 0 ? -3 : 2.5}deg)`,
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  const nick = useStore((s) => s.nick);
  const avatar = useStore((s) => s.avatar);
  const joinCode = useStore((s) => s.joinCode);
  const fromLink = useStore((s) => s.fromLink);
  const busy = useStore((s) => s.busy);
  const homeError = useStore((s) => s.homeError);

  const [joinOpen, setJoinOpen] = useState(fromLink);
  const [vibOn, setVibOn] = useState(hapticsEnabled);
  const root = useRef<HTMLDivElement>(null);

  function toggleVib() {
    const next = !vibOn;
    setVibOn(next);
    setHapticsEnabled(next);
    if (next) haptics.tick(); // acilirken minik deneme titresimi
  }

  useEffect(() => {
    staggerIn(root.current);
  }, []);

  useEffect(() => {
    if (fromLink) setJoinOpen(true);
  }, [fromLink]);

  function requireNick(): boolean {
    if (!nick.trim()) {
      useStore.getState().setHomeError('Önce bir takma ad gir');
      return false;
    }
    return true;
  }

  async function onCreate() {
    if (!requireNick()) return;
    const st = useStore.getState();
    st.setBusy(true);
    st.setHomeError(null);
    try {
      const code = await apiCreateRoom();
      location.hash = `#/oda/${code}`;
      st.enterRoom(code);
      connect(code);
    } catch {
      st.setHomeError('Sunucuya ulaşılamadı');
    } finally {
      st.setBusy(false);
    }
  }

  async function onJoin() {
    if (!requireNick()) return;
    const code = joinCode.trim().toUpperCase();
    const st = useStore.getState();
    if (!code) {
      st.setHomeError('Oda kodunu gir');
      return;
    }
    st.setBusy(true);
    st.setHomeError(null);
    try {
      const info = await apiCheckRoom(code);
      if (!info.exists) {
        st.setHomeError('Oda bulunamadı');
        return;
      }
      if (!info.joinable) {
        st.setHomeError('Oda dolu');
        return;
      }
      location.hash = `#/oda/${code}`;
      st.enterRoom(code);
      connect(code);
    } catch {
      st.setHomeError('Sunucuya ulaşılamadı');
    } finally {
      st.setBusy(false);
    }
  }

  return (
    <div ref={root} className="flex w-full flex-col items-center gap-5 pt-10 pb-6">
      <Logo />
      <p data-pop className="text-center text-[15px] font-bold" style={{ color: 'var(--ink-soft)' }}>
        Harfini seç, kelimeyi ilk sen bul.
        <br />
        1v1 Türkçe kelime düellosu.
      </p>

      {fromLink && (
        <div data-pop className="chip chip-sun" role="status">
          Bir odaya davetlisin, takma adını yaz ve katıl
        </div>
      )}

      <div data-pop className="card-candy w-full">
        <label
          htmlFor="nick"
          className="font-display mb-2 block text-sm font-bold"
          style={{ color: 'var(--ink-soft)' }}
        >
          Takma adın
        </label>
        <input
          id="nick"
          className="input-candy"
          type="text"
          value={nick}
          maxLength={MAX_NICK_LEN}
          placeholder="ör. kelimeci"
          autoComplete="nickname"
          onChange={(e) => useStore.getState().setNick(e.target.value)}
        />
        <p className="font-display mt-5 mb-2 text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>
          Karakterini seç
        </p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Avatar seçimi">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={avatar === i}
              aria-label={AVATAR_NAMES[i]}
              className={`avatar-pick ${avatar === i ? 'sel' : ''}`}
              onClick={() => useStore.getState().setAvatar(i)}
            >
              <Avatar index={i} color={AVATAR_PICK_COLORS[i]} size={44} />
            </button>
          ))}
        </div>
        {/* titresim ayari (iOS Safari titresimi desteklemez, orada sessiz kalir) */}
        <div className="mt-5 flex items-center justify-between">
          <span
            id="vib-label"
            className="font-display text-sm font-bold"
            style={{ color: 'var(--ink-soft)' }}
          >
            Titreşim
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={vibOn}
            aria-labelledby="vib-label"
            className={`toggle-candy ${vibOn ? 'on' : ''}`}
            onClick={toggleVib}
          >
            <span className="knob" aria-hidden="true" />
          </button>
        </div>
      </div>

      {homeError && (
        <div className="chip chip-err" role="alert">
          {homeError}
        </div>
      )}

      <div data-pop className="w-full">
        <button
          type="button"
          className="btn-candy btn-p1 btn-lg btn-block"
          disabled={busy}
          onClick={() => void onCreate()}
        >
          Oda kur
        </button>
      </div>

      <div data-pop className="w-full">
        {joinOpen ? (
          <form
            className="card-candy flex w-full flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onJoin();
            }}
          >
            <label
              htmlFor="code"
              className="font-display text-sm font-bold"
              style={{ color: 'var(--ink-soft)' }}
            >
              Oda kodu
            </label>
            <input
              id="code"
              className="input-candy input-code"
              type="text"
              value={joinCode}
              maxLength={8}
              placeholder="KOD"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => useStore.getState().setJoinCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn-candy btn-p2 btn-block" disabled={busy}>
              Koda katıl
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="btn-candy btn-p2 btn-lg btn-block"
            onClick={() => setJoinOpen(true)}
          >
            Koda katıl
          </button>
        )}
      </div>
    </div>
  );
}
