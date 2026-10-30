// One game room = one Cloudflare Durable Object, named by its 4-letter code.
// It holds the room state, accepts WebSocket connections from the TV and the
// phones, and applies the rules in logic.js. It uses the WebSocket Hibernation
// API so idle rooms cost nothing while everyone is thinking.

import * as L from './logic.js';

const ROOM_IDLE_MS = 6 * 60 * 60 * 1000; // forget a room 6 hours after its last activity
const MAX_MESSAGE_BYTES = 8 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function randomToken(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.now = () => Date.now();
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
    });
  }

  async save() {
    await this.ctx.storage.put('room', this.room);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = this.now();

    if (url.pathname === '/create' && request.method === 'POST') {
      const { code } = await request.json();
      if (this.room && now - this.room.lastActive < ROOM_IDLE_MS) return json({ error: 'taken' }, 409);
      this.room = L.newRoom(code, randomToken(), now);
      await this.save();
      await this.ctx.storage.setAlarm(now + ROOM_IDLE_MS);
      return json({ code, tvKey: this.room.tvKey });
    }

    if (url.pathname === '/info') {
      if (!this.room) return json({ exists: false });
      return json({
        exists: true,
        started: this.room.started,
        players: this.room.players.length,
        full: this.room.players.length >= L.MAX_PLAYERS,
        taken: this.room.players.map((p) => p.vehicle),
      });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected websocket' }, 426);
      if (!this.room) return json({ error: 'no such room' }, 404);
      const role = url.searchParams.get('role');
      if (role === 'tv' && url.searchParams.get('key') !== this.room.tvKey) return json({ error: 'bad key' }, 403);
      if (role !== 'tv' && role !== 'player') return json({ error: 'bad role' }, 400);

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      if (role === 'tv') {
        // Only one TV per room: a reconnecting TV replaces the old connection.
        for (const ws of this.ctx.getWebSockets('tv')) {
          try { ws.close(4000, 'replaced'); } catch {}
        }
      }
      this.ctx.acceptWebSocket(server, [role]);
      server.serializeAttachment({ role, playerId: null });
      if (role === 'tv') {
        server.send(JSON.stringify({ ...L.lobbyMessage(this.room), t: 'hello' }));
      } else {
        server.send(JSON.stringify({ t: 'hello', code: this.room.code, started: this.room.started }));
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ error: 'not found' }, 404);
  }

  async webSocketMessage(ws, data) {
    if (!this.room) return;
    if (typeof data !== 'string' || data.length > MAX_MESSAGE_BYTES) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg && msg.t === 'ping') { ws.send('{"t":"pong"}'); return; }

    const att = ws.deserializeAttachment() || {};
    const now = this.now();
    let result;

    if (att.role === 'tv' && msg && msg.t === 'close') {
      // The TV ended this room (a player left mid-game, or the TV went back to its start screen).
      await this.closeRoom(typeof msg.reason === 'string' ? msg.reason.slice(0, 200) : '');
      return;
    }
    if (att.role === 'tv') {
      result = L.fromTv(this.room, msg, now);
    } else if (msg && msg.t === 'join') {
      result = L.join(this.room, msg, now, crypto.randomUUID(), randomToken());
      if (!result.error) {
        const joined = result.out.find((o) => o.msg.t === 'joined');
        if (joined) ws.serializeAttachment({ role: 'player', playerId: joined.to });
      }
    } else if (att.playerId) {
      result = L.fromPlayer(this.room, att.playerId, msg, now);
    } else {
      result = { state: this.room, out: [], error: { code: 'join', message: 'Join the room first.' } };
    }

    if (result.error) {
      ws.send(JSON.stringify({ t: 'error', ...result.error }));
      return;
    }
    this.room = result.state;
    await this.save();
    this.deliver(result.out, ws);
  }

  async webSocketClose(ws) {
    await this.dropped(ws);
  }

  async webSocketError(ws) {
    await this.dropped(ws);
  }

  async dropped(ws) {
    const att = ws.deserializeAttachment() || {};
    if (!this.room || att.role !== 'player' || !att.playerId) return;
    // Still connected on another socket (e.g. a second browser tab)? Then nothing changed.
    const stillHere = this.ctx.getWebSockets('player').some((s) => s !== ws && (s.deserializeAttachment() || {}).playerId === att.playerId);
    if (stillHere) return;
    const result = L.disconnect(this.room, att.playerId, this.now());
    this.room = result.state;
    await this.save();
    this.deliver(result.out, ws);
  }

  deliver(out, origin) {
    if (!out.length) return;
    const sockets = this.ctx.getWebSockets().map((ws) => ({ ws, att: ws.deserializeAttachment() || {} }));
    for (const { to, msg } of out) {
      const text = JSON.stringify(msg);
      for (const { ws, att } of sockets) {
        const match =
          (to === 'tv' && att.role === 'tv') ||
          (to === 'players' && att.role === 'player' && att.playerId) ||
          (att.role === 'player' && att.playerId === to);
        if (!match) continue;
        try { ws.send(text); } catch {}
      }
    }
  }

  async closeRoom(reason) {
    const text = JSON.stringify({ t: 'closed', reason });
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() || {};
      if (att.role === 'player') { try { ws.send(text); } catch {} }
      try { ws.close(4001, 'room closed'); } catch {}
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  async alarm() {
    const now = this.now();
    if (this.room && now - this.room.lastActive < ROOM_IDLE_MS) {
      await this.ctx.storage.setAlarm(this.room.lastActive + ROOM_IDLE_MS);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(4001, 'room closed'); } catch {}
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }
}
