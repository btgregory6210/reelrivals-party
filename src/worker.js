// Front door for reelrivals.app.
//   POST /api/rooms              -> the TV asks for a new room; returns { code, tvKey }
//                                   ({ edition: 'kingdom', pass } makes a Kingdom Christmas party room)
//   POST /api/kingdom            -> { pass } -> the Kingdom Christmas question set (passcode required)
//   GET  /api/rooms/ABCD         -> does room ABCD exist? (the phone checks before joining)
//   GET  /api/rooms/ABCD/ws      -> WebSocket into the room (?role=tv&key=… or ?role=player)
// Everything else is the phone page and images in /public.

import { randomCode, isValidCode } from './logic.js';
import KINGDOM from './kingdom/questions.js';

// Kingdom Christmas (private party edition). The big-screen page asks for this passcode once; only its
// SHA-256 is kept here. The company questions are only ever sent to a browser that knows it.
const KINGDOM_PASS_SHA256 = '7962057d05764d896adcb5469145ac20f34b24b4fab9f89ac9000532f76d6222';

async function kingdomPassOk(pass) {
  if (typeof pass !== 'string' || !pass) return false;
  const bytes = new TextEncoder().encode(pass.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === KINGDOM_PASS_SHA256;
}

export { Room } from './room.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function roomStub(env, code) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/kingdom' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!(await kingdomPassOk(body.pass))) return json({ error: 'That passcode isn\'t right.' }, 403);
      return json(KINGDOM);
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      let edition = 'movienight';
      if (body && body.edition === 'kingdom') {
        if (!(await kingdomPassOk(body.pass))) return json({ error: 'That passcode isn\'t right.' }, 403);
        edition = 'kingdom';
      }
      for (let attempt = 0; attempt < 12; attempt++) {
        const code = randomCode();
        const res = await roomStub(env, code).fetch('https://room/create', {
          method: 'POST',
          body: JSON.stringify({ code, edition }),
        });
        if (res.status === 409) continue; // code in use, try another
        return json(await res.json(), res.status);
      }
      return json({ error: 'Could not find a free room code. Try again.' }, 503);
    }

    const m = url.pathname.match(/^\/api\/rooms\/([A-Za-z]{4})(\/ws)?$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!isValidCode(code)) return json({ exists: false });
      const stub = roomStub(env, code);
      if (m[2]) {
        return stub.fetch(new Request(`https://room/ws${url.search}`, request));
      }
      const res = await stub.fetch('https://room/info');
      return json(await res.json(), res.status);
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
