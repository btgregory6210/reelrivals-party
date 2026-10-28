// Front door for reelrivals.app.
//   POST /api/rooms              -> the TV asks for a new room; returns { code, tvKey }
//   GET  /api/rooms/ABCD         -> does room ABCD exist? (the phone checks before joining)
//   GET  /api/rooms/ABCD/ws      -> WebSocket into the room (?role=tv&key=… or ?role=player)
// Everything else is the phone page and images in /public.

import { randomCode, isValidCode } from './logic.js';

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

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      for (let attempt = 0; attempt < 12; attempt++) {
        const code = randomCode();
        const res = await roomStub(env, code).fetch('https://room/create', {
          method: 'POST',
          body: JSON.stringify({ code }),
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
