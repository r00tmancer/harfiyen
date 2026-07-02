import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useStore } from './store';
import { initSfx } from './fx/sfx';

// davet linki: #/oda/KOD -> katilma akisini onden doldur
// hem ilk yuklemede hem de ayni sekmede hash degistiginde (ikinci davet linki) calismali
function applyInviteHash() {
  const m = /^#\/oda\/([A-Za-z0-9]+)/.exec(location.hash);
  if (m) useStore.getState().prefillJoin(m[1].toUpperCase());
}
applyInviteHash();
window.addEventListener('hashchange', applyInviteHash);

initSfx();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
