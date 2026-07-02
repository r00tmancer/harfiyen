// API tabani: prod'da VITE_API_URL, yerelde worker dev portu.
export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

// http(s) -> ws(s) donusumuyle oda soketi adresi uretir.
export function wsUrl(code: string, params: Record<string, string>): string {
  const u = new URL(API_BASE);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = u.pathname.replace(/\/+$/, '');
  u.pathname = `${basePath}/ws/${encodeURIComponent(code)}`;
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}
