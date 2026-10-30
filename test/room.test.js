// End-to-end check of worker.js + room.js using stand-ins for Cloudflare's
// runtime (Durable Object storage, WebSocketPair). It plays a whole short game:
// TV makes a room, phones join, host starts, vote, question, answers, reveal,
// a phone drops and rejoins, and bad requests are refused.
import test from 'node:test';
import assert from 'node:assert/strict';

// --- Cloudflare stand-ins ---------------------------------------------------
const RealResponse = globalThis.Response;
globalThis.Response = function (body, init) {
  if (init && init.status === 101) return { status: 101, webSocket: init.webSocket };
  return new RealResponse(body, init);
};

class FakeSocket {
  constructor() { this.peer = null; this.inbox = []; this.closed = null; this.att = null; }
  send(data) { if (this.closed) throw new Error('closed'); this.peer.inbox.push(JSON.parse(data)); }
  close(code, reason) { this.closed = { code, reason }; }
  serializeAttachment(v) { this.att = structuredClone(v); }
  deserializeAttachment() { return structuredClone(this.att); }
}
globalThis.WebSocketPair = function () {
  const client = new FakeSocket();
  const server = new FakeSocket();
  client.peer = server; server.peer = client;
  return { 0: client, 1: server };
};

function fakeCtx() {
  const data = new Map();
  const sockets = [];
  return {
    alarm: null,
    storage: {
      async get(k) { return structuredClone(data.get(k)); },
      async put(k, v) { data.set(k, structuredClone(v)); },
      async deleteAll() { data.clear(); },
      async setAlarm(t) { this._alarm = t; },
    },
    blockConcurrencyWhile(fn) { return fn(); },
    acceptWebSocket(ws, tags) { sockets.push({ ws, tags }); },
    getWebSockets(tag) {
      return sockets.filter((s) => !s.ws.closed && (!tag || s.tags.includes(tag))).map((s) => s.ws);
    },
  };
}

const { default: worker, Room } = await import('../src/worker.js');

const rooms = new Map();
const env = {
  ROOMS: {
    idFromName: (name) => name,
    get(id) {
      if (!rooms.has(id)) rooms.set(id, new Room(fakeCtx(), env));
      const room = rooms.get(id);
      return { fetch: (input, init) => room.fetch(input instanceof Request ? input : new Request(input, init)) };
    },
  },
  ASSETS: { fetch: async () => new RealResponse('phone page') },
};

const BASE = 'https://reelrivals.app';
const call = (path, init) => worker.fetch(new Request(BASE + path, init), env);

async function connect(code, query) {
  const res = await call(`/api/rooms/${code}/ws?${query}`, { headers: { Upgrade: 'websocket' } });
  if (res.status !== 101) return { status: res.status };
  const client = res.webSocket;
  const server = client.peer;
  const room = rooms.get(code);
  return {
    status: 101,
    client,
    server,
    async send(msg) { await room.webSocketMessage(server, JSON.stringify(msg)); },
    async drop() { server.close(1001, 'gone'); await room.webSocketClose(server); },
    last(t) { return [...client.inbox].reverse().find((m) => m.t === t); },
    all(t) { return client.inbox.filter((m) => m.t === t); },
  };
}

// --- The game -------------------------------------------------------------------
test('a short party game from start to reveal', async () => {
  // TV creates a room.
  const created = await (await call('/api/rooms', { method: 'POST' })).json();
  assert.match(created.code, /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  assert.equal(typeof created.tvKey, 'string');
  const code = created.code;

  // Wrong TV key is refused; right one connects.
  assert.equal((await connect(code, 'role=tv&key=wrong')).status, 403);
  const tv = await connect(code, `role=tv&key=${created.tvKey}`);
  assert.equal(tv.status, 101);
  assert.equal(tv.last('hello').code, code);

  // Phone checks the code exists (lower case typed is fine).
  const info = await (await call(`/api/rooms/${code.toLowerCase()}`)).json();
  assert.deepEqual([info.exists, info.started, info.players], [true, false, 0]);
  assert.equal((await (await call('/api/rooms/ZZZZ')).json()).exists, false);
  assert.equal((await (await call('/api/rooms/AEIO')).json()).exists, false);

  // Three phones join.
  const brandon = await connect(code, 'role=player');
  const maya = await connect(code, 'role=player');
  const jordan = await connect(code, 'role=player');
  await brandon.send({ t: 'join', name: 'Brandon', vehicle: 'trex' });
  await maya.send({ t: 'join', name: 'Maya', vehicle: 'chariot' });
  await jordan.send({ t: 'join', name: 'Jordan', vehicle: 'chariot' }); // taken
  assert.equal(jordan.last('error').code, 'vehicle');
  await jordan.send({ t: 'join', name: 'Jordan', vehicle: 'train' });

  const bId = brandon.last('joined').playerId;
  const bToken = brandon.last('joined').token;
  const roster = tv.last('lobby');
  assert.deepEqual(roster.players.map((p) => p.name), ['Brandon', 'Maya', 'Jordan']);
  assert.equal(roster.hostId, bId);
  assert.equal(maya.last('lobby').players.length, 3);
  assert.equal(JSON.stringify(tv.client.inbox).includes(bToken), false, 'TV never sees rejoin tokens');

  // Non-host can't start; host picks Quick and starts.
  await maya.send({ t: 'start' });
  assert.equal(maya.last('error').code, 'host');
  await brandon.send({ t: 'length', length: 'quick' });
  await brandon.send({ t: 'start' });
  const start = tv.last('start');
  assert.deepEqual([start.length, start.rounds, start.questionsPerRound], ['quick', 3, 4]);

  // Category vote.
  await tv.send({ t: 'phase', phase: { type: 'vote', round: 1, rounds: 3, options: ['Famous Quotes', 'Horror', 'Pixar'], durationMs: 10000 } });
  assert.deepEqual(maya.last('phase').options, ['Famous Quotes', 'Horror', 'Pixar']);
  await maya.send({ t: 'vote', choice: 0 });
  await jordan.send({ t: 'vote', choice: 1 });
  await brandon.send({ t: 'vote', choice: 0 });
  assert.deepEqual(tv.last('votes').tallies.map((x) => x.length), [2, 1, 0]);

  // A question.
  await tv.send({ t: 'phase', phase: { type: 'question', round: 1, rounds: 3, question: 1, questions: 4, category: 'Oscars', prompt: 'Which film won Best Picture at the 1998 Academy Awards?', answers: ['Titanic', 'Good Will Hunting', 'As Good as It Gets', 'L.A. Confidential'], durationMs: 20000 } });
  const q = jordan.last('phase');
  assert.equal(q.type, 'question');
  assert.equal(q.answers[0], 'Titanic');
  assert.ok(q.remainingMs > 19000);
  await maya.send({ t: 'answer', choice: 0 });
  await maya.send({ t: 'answer', choice: 1 }); // second tap ignored
  assert.equal(maya.last('error').code, 'locked');
  await brandon.send({ t: 'answer', choice: 1 });
  const answers = tv.all('answer');
  assert.equal(answers.length, 2);
  assert.equal(answers[0].choice, 0);
  assert.equal(answers[1].answered, 2);

  // Jordan's phone drops mid-question and comes back with its token.
  const jId = jordan.last('joined').playerId;
  const jToken = jordan.last('joined').token;
  await jordan.drop();
  assert.equal(tv.last('lobby').players.find((p) => p.id === jId).connected, false);
  const jordan2 = await connect(code, 'role=player');
  await jordan2.send({ t: 'join', playerId: jId, token: jToken });
  assert.equal(jordan2.last('joined').playerId, jId);
  assert.equal(jordan2.last('phase').type, 'question', 'rejoining phone lands on the open question');
  await jordan2.send({ t: 'answer', choice: 0 });
  assert.equal(tv.all('answer').length, 3);

  // Reveal: each phone sees only its own result.
  await tv.send({ t: 'phase', phase: { type: 'reveal', correct: 0, correctText: 'Titanic', note: 'Titanic won 11 Oscars that night.', results: {
    [maya.last('joined').playerId]: { correct: true, points: 920, total: 920, rank: 1, fastest: true },
    [bId]: { correct: false, points: 0, total: 0, rank: 3 },
    [jId]: { correct: true, points: 780, total: 780, rank: 2 },
  } } });
  assert.equal(maya.last('phase').me.points, 920);
  assert.equal(brandon.last('phase').me.correct, false);
  assert.equal(brandon.last('phase').myAnswer, 1);
  assert.equal(jordan2.last('phase').me.rank, 2);

  // A new phone can't join mid-game.
  const late = await connect(code, 'role=player');
  await late.send({ t: 'join', name: 'Sam', vehicle: 'saucer' });
  assert.equal(late.last('error').code, 'started');

  // Junk is ignored or answered politely.
  await maya.send({ t: 'nonsense' });
  assert.equal(maya.last('error').code, 'message');
  const before = maya.client.inbox.length;
  await rooms.get(code).webSocketMessage(maya.server, 'not json');
  await rooms.get(code).webSocketMessage(maya.server, 'x'.repeat(9000));
  assert.equal(maya.client.inbox.length, before);
});

test('a second TV connection replaces the first', async () => {
  const { code, tvKey } = await (await call('/api/rooms', { method: 'POST' })).json();
  const tv1 = await connect(code, `role=tv&key=${tvKey}`);
  const tv2 = await connect(code, `role=tv&key=${tvKey}`);
  assert.equal(tv1.server.closed.code, 4000);
  assert.equal(tv2.server.closed, null);
});

test('websocket route requires an upgrade request and a known role', async () => {
  const { code } = await (await call('/api/rooms', { method: 'POST' })).json();
  assert.equal((await call(`/api/rooms/${code}/ws?role=player`)).status, 426);
  assert.equal((await connect(code, 'role=spy')).status, 400);
  assert.equal((await connect('ZZZZ', 'role=player')).status, 404);
});

test('other paths serve the phone page; unknown api paths 404', async () => {
  assert.equal(await (await call('/')).text(), 'phone page');
  assert.equal(await (await call('/?room=KRMV')).text(), 'phone page');
  assert.equal((await call('/api/nope')).status, 404);
});

test('idle rooms are cleaned up by the alarm', async () => {
  const { code } = await (await call('/api/rooms', { method: 'POST' })).json();
  const room = rooms.get(code);
  room.now = () => Date.now() + 7 * 60 * 60 * 1000;
  await room.alarm();
  assert.equal(room.room, null);
  assert.equal((await (await call(`/api/rooms/${code}`)).json()).exists, false);
});

test('the TV can close the room: phones are told why and disconnected', async () => {
  const { code, tvKey } = await (await call('/api/rooms', { method: 'POST' })).json();
  const tv = await connect(code, `role=tv&key=${tvKey}`);
  const p = await connect(code, 'role=player');
  await p.send({ t: 'join', name: 'Maya', vehicle: 'jeep' });
  await tv.send({ t: 'close', reason: 'Maya left, so this game ended. Join the new room code on the TV.' });
  assert.match(p.last('closed').reason, /new room code/);
  assert.equal(p.server.closed.code, 4001);
  assert.equal((await (await call(`/api/rooms/${code}`)).json()).exists, false);
});
