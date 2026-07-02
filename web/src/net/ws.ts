import type { ClientMsg, ServerMsg } from '@harfiyen/shared';
import { API_BASE, wsUrl } from '../config';
import { useStore } from '../store';

const PID_KEY = 'harfiyen:pid';

// kalici oyuncu kimligi; kopan baglantida ayni pid ile geri donulur
export function getPid(): string {
  let pid = localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = crypto.randomUUID();
    localStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

let sock: WebSocket | null = null;
let currentCode: string | null = null;
let retry = 0;
let retryTimer: number | null = null;
let manualClose = false;

export function connect(code: string): void {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  currentCode = code;
  manualClose = false;
  retry = 0;
  openSocket();
}

function openSocket(): void {
  retryTimer = null;
  if (!currentCode) return;
  const st = useStore.getState();
  st.setConn(retry === 0 ? 'connecting' : 'reconnecting');

  const url = wsUrl(currentCode, {
    nick: st.nick,
    avatar: String(st.avatar),
    pid: getPid(),
  });
  const ws = new WebSocket(url);
  sock = ws;

  ws.onopen = () => {
    if (sock !== ws) return;
    retry = 0;
    useStore.getState().setConn('open');
  };

  ws.onmessage = (ev) => {
    if (sock !== ws) return;
    let msg: ServerMsg;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMsg;
    } catch {
      return;
    }
    if (msg.t === 'error' && (msg.code === 'room_full' || msg.code === 'not_found')) {
      // olmayan/dolu oda: tekrar deneme, ana ekrana don
      manualClose = true;
      currentCode = null;
      clearRoomHash();
    }
    useStore.getState().apply(msg);
  };

  ws.onclose = () => {
    if (sock !== ws) return;
    sock = null;
    if (manualClose) {
      useStore.getState().setConn('idle');
      return;
    }
    scheduleReconnect();
  };
}

function scheduleReconnect(): void {
  // yalnizca oda ekranlari aktifken yeniden dene
  if (useStore.getState().screen === 'home') return;
  useStore.getState().setConn('reconnecting');
  const delay = Math.min(1000 * 2 ** retry, 10_000); // 1s -> 2s -> 4s -> ... max 10s
  retry += 1;
  retryTimer = window.setTimeout(openSocket, delay);
}

export function send(msg: ClientMsg): void {
  if (sock && sock.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify(msg));
  }
}

function clearRoomHash(): void {
  history.replaceState(null, '', location.pathname + location.search);
}

// odayi bilerek terk et: soketi kapat, hash'i sil, ana ekrana don
export function leaveRoom(): void {
  manualClose = true;
  currentCode = null;
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (sock) {
    sock.close();
    sock = null;
  }
  clearRoomHash();
  useStore.getState().leaveToHome();
}

// ---- REST ----
export async function apiCreateRoom(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('create_failed');
  const data = (await res.json()) as { code: string };
  return data.code;
}

export async function apiCheckRoom(code: string): Promise<{ exists: boolean; joinable: boolean }> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('check_failed');
  return (await res.json()) as { exists: boolean; joinable: boolean };
}
