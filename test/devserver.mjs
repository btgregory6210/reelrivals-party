// Local stand-in for Cloudflare, for trying the phone page on this computer.
// Serves /public, runs worker.js for /api, and speaks real WebSockets (a small
// hand-written WebSocket server, so no downloads are needed).
//   node test/devserver.mjs [port]
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8787);

// --- Cloudflare stand-ins ------------------------------------------------------
const RealResponse = globalThis.Response;
globalThis.Response = function (body, init) {
  if (init && init.status === 101) return { status: 101, webSocket: init.webSocket };
  return new RealResponse(body, init);
};

class ServerSide {
  constructor() { this.sock = null; this.queue = []; this.closed = null; this.att = null; }
  send(data) {
    if (this.closed) throw new Error('closed');
    if (!this.sock) { this.queue.push(data); return; }
    this.sock.write(frame(0x1, Buffer.from(data)));
  }
  close(code = 1000, reason = '') {
    if (this.closed) return;
    this.closed = { code, reason };
    const body = Buffer.alloc(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    if (this.sock) { this.sock.write(frame(0x8, body)); this.sock.end(); }
  }
  bind(sock) { this.sock = sock; for (const d of this.queue) this.send(d); this.queue = []; }
  serializeAttachment(v) { this.att = structuredClone(v); }
  deserializeAttachment() { return structuredClone(this.att); }
}
globalThis.WebSocketPair = function () {
  const server = new ServerSide();
  const client = { peer: server };
  return { 0: client, 1: server };
};

function fakeCtx() {
  const data = new Map();
  const sockets = [];
  return {
    storage: {
      async get(k) { return structuredClone(data.get(k)); },
      async put(k, v) { data.set(k, structuredClone(v)); },
      async deleteAll() { data.clear(); },
      async setAlarm() {},
    },
    blockConcurrencyWhile(fn) { return fn(); },
    acceptWebSocket(ws, tags) { sockets.push({ ws, tags }); },
    getWebSockets(tag) { return sockets.filter((s) => !s.ws.closed && (!tag || s.tags.includes(tag))).map((s) => s.ws); },
  };
}

const { default: worker, Room } = await import(path.join(root, 'src/worker.js'));
const rooms = new Map();
const env = {
  ROOMS: {
    idFromName: (n) => n,
    get(id) {
      if (!rooms.has(id)) rooms.set(id, new Room(fakeCtx(), env));
      const room = rooms.get(id);
      return { fetch: (input, init) => room.fetch(input instanceof Request ? input : new Request(input, init)) };
    },
  },
  ASSETS: {
    async fetch(req) {
      const url = new URL(req.url);
      let p = decodeURIComponent(url.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(root, 'public', path.normalize(p));
      if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return new RealResponse('Not found', { status: 404 });
      }
      const type = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
      return new RealResponse(fs.readFileSync(file), { headers: { 'content-type': type } });
    },
  },
};

// --- WebSocket framing -----------------------------------------------------------
function frame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

function attach(sock, server, room) {
  let buf = Buffer.alloc(0);
  let gone = false;
  const done = () => { if (gone) return; gone = true; server.closed = server.closed || { code: 1006 }; room.webSocketClose(server); };
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const masked = buf[1] & 0x80;
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) return;
      let payload = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = buf.subarray(off, off + 4);
        payload = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
      }
      buf = buf.subarray(need);
      if (op === 0x1) room.webSocketMessage(server, payload.toString('utf8'));
      else if (op === 0x8) { try { sock.write(frame(0x8, payload)); } catch {} sock.end(); done(); }
      else if (op === 0x9) sock.write(frame(0xA, payload));
    }
  });
  sock.on('close', done);
  sock.on('error', done);
}

// --- HTTP server ---------------------------------------------------------------------
const srv = http.createServer(async (req, res) => {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((r) => {
    const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => r(Buffer.concat(chunks)));
  });
  const r = await worker.fetch(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});

srv.on('upgrade', async (req, sock) => {
  const url = new URL(`http://localhost:${PORT}${req.url}`);
  const m = url.pathname.match(/^\/api\/rooms\/([A-Za-z]{4})\/ws$/);
  const r = await worker.fetch(new Request(url, { headers: req.headers }), env);
  if (!m || r.status !== 101) {
    sock.end(`HTTP/1.1 ${r.status} Refused\r\nConnection: close\r\n\r\n`);
    return;
  }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const server = r.webSocket.peer;
  server.bind(sock);
  attach(sock, server, rooms.get(m[1].toUpperCase()));
});

srv.listen(PORT, () => console.log(`Reel Rivals dev server on http://localhost:${PORT}`));
