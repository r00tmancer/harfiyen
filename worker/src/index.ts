// Harfiyen worker girisi: REST + WS yonlendirme, origin allowlist.
import type { Env } from './env';

export { GameRoom } from './room';

// Karistirilabilir karakterler (I, O, Q, X, W, 0, 1) alfabede yok.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const CODE_LEN = 5;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`);
const MAX_CODE_TRIES = 5;

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

function roomStub(env: Env, code: string): DurableObjectStub {
  return env.ROOM.get(env.ROOM.idFromName(code));
}

function withCors(res: Response, origin: string | null): Response {
  if (!origin) return res;
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  return new Response(res.body, { status: res.status, headers });
}

function preflight(request: Request, origin: string | null): Response {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(null, { status: 204, headers });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === '/api/health') {
    return request.method === 'GET'
      ? Response.json({ ok: true })
      : new Response('yontem uygun degil', { status: 405 });
  }

  if (path === '/api/rooms') {
    if (request.method !== 'POST') return new Response('yontem uygun degil', { status: 405 });
    for (let i = 0; i < MAX_CODE_TRIES; i++) {
      const code = generateCode();
      const res = await roomStub(env, code).fetch(`https://do/reserve?code=${code}`, { method: 'POST' });
      if (res.ok) return Response.json({ code });
      // 409: kod zaten aktif bir odada, yeni kod dene
    }
    return Response.json({ error: 'oda kodu uretilemedi' }, { status: 503 });
  }

  const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch) {
    if (request.method !== 'GET') return new Response('yontem uygun degil', { status: 405 });
    const code = roomMatch[1].toUpperCase();
    if (!CODE_RE.test(code)) return Response.json({ exists: false, joinable: false });
    return roomStub(env, code).fetch('https://do/status');
  }

  return new Response('bulunamadi', { status: 404 });
}

function handleWs(request: Request, env: Env, url: URL, origin: string | null, allowed: string[]): Response | Promise<Response> {
  // Once upgrade ve origin dogrulanir; WS CORS'a tabi degildir, guvenlik siniri burasi.
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('websocket upgrade gerekli', { status: 426 });
  }
  if (origin && !allowed.includes(origin)) {
    return new Response('izin verilmeyen origin', { status: 403 });
  }
  const match = url.pathname.match(/^\/ws\/([^/]+)$/);
  const code = match ? match[1].toUpperCase() : '';
  if (!CODE_RE.test(code)) {
    return new Response('gecersiz oda kodu', { status: 404 });
  }
  return roomStub(env, code).fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = allowedOrigins(env);

    if (url.pathname.startsWith('/api/')) {
      if (origin && !allowed.includes(origin)) {
        return new Response('izin verilmeyen origin', { status: 403 });
      }
      if (request.method === 'OPTIONS') return preflight(request, origin);
      return withCors(await handleApi(request, env, url), origin);
    }

    if (url.pathname.startsWith('/ws/')) {
      return handleWs(request, env, url, origin, allowed);
    }

    // API/WS disindaki her sey statik site (Workers assets)
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
