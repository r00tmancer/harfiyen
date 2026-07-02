import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useStore } from './store';
import { initSfx } from './fx/sfx';

// davet linki: #/oda/KOD -> katilma akisini onden doldur
const m = /^#\/oda\/([A-Za-z0-9]+)/.exec(location.hash);
if (m) useStore.getState().prefillJoin(m[1].toUpperCase());

initSfx();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
