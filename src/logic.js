// Pure game-room rules for Reel Rivals: Movie Night.
//
// The Apple TV runs the game (questions, timing, scoring). The room service in
// between keeps the player list, enforces the rules below, stamps answer times
// with its own clock, and relays messages between the TV and the phones.
//
// Every function takes the room state and returns { state, out, error }, where
// `out` is a list of messages to send: { to: 'tv' | 'players' | <playerId>, msg }.
// Nothing here touches the network, so it can be tested on its own.

import { VEHICLE_IDS } from './vehicles.js';

export const MAX_PLAYERS = 10;
export const MIN_PLAYERS = 2;
export const NAME_MAX = 12;
export const LENGTHS = { quick: 3, standard: 5, marathon: 8 };
export const QUESTIONS_PER_ROUND = 4;
export const ANSWER_GRACE_MS = 600; // network slack after the timer hits zero
const PHASES = new Set(['lobby', 'vote', 'question', 'reveal', 'scores', 'final']);

// Consonants only, so a random code never spells a real word. 20^4 = 160,000 codes.
export const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';

export function randomCode(rand = Math.random) {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)];
  return code;
}

export function isValidCode(code) {
  return typeof code === 'string' && /^[A-Z]{4}$/.test(code) && [...code].every((c) => CODE_LETTERS.includes(c));
}

export function newRoom(code, tvKey, now) {
  return {
    code,
    tvKey,
    createdAt: now,
    lastActive: now,
    length: 'standard',
    started: false,
    phase: { type: 'lobby', seq: 0 },
    players: [],
  };
}

const ok = (state, out = []) => ({ state, out, error: null });
const fail = (state, code, message) => ({ state, out: [], error: { code, message } });

export function cleanName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

export function hostId(state) {
  const connected = state.players.filter((p) => p.connected);
  const pool = connected.length ? connected : state.players;
  return pool.length ? pool[0].id : null; // players stay in join order
}

export function publicPlayers(state) {
  return state.players.map((p) => ({ id: p.id, name: p.name, vehicle: p.vehicle, connected: p.connected }));
}

export function lobbyMessage(state) {
  return {
    t: 'lobby',
    code: state.code,
    players: publicPlayers(state),
    hostId: hostId(state),
    length: state.length,
    rounds: LENGTHS[state.length],
    started: state.started,
  };
}

// Messages that keep everyone's player list current.
function rosterOut(state) {
  const msg = lobbyMessage(state);
  return [{ to: 'tv', msg }, { to: 'players', msg }];
}

function touch(state, now) {
  return { ...state, lastActive: now };
}

function vehicleTaken(state, vehicle, exceptId) {
  return state.players.some((p) => p.vehicle === vehicle && p.id !== exceptId);
}

function nameTaken(state, name, exceptId) {
  const n = name.toLowerCase();
  return state.players.some((p) => p.name.toLowerCase() === n && p.id !== exceptId);
}

// A phone joins, or rejoins after a dropped connection (same playerId plus its
// private rejoin token, which only that phone was given).
export function join(state, { name, vehicle, playerId, token }, now, newId, newToken) {
  const existing = playerId && token ? state.players.find((p) => p.id === playerId && p.token === token) : null;
  if (existing) {
    const players = state.players.map((p) => (p.id === existing.id ? { ...p, connected: true } : p));
    const s = touch({ ...state, players }, now);
    const out = [{ to: existing.id, msg: { t: 'joined', playerId: existing.id, token: existing.token, name: existing.name, vehicle: existing.vehicle } }];
    out.push(...rosterOut(s));
    const resume = currentPhaseFor(s, existing.id, now);
    if (resume) out.push({ to: existing.id, msg: resume });
    return ok(s, out);
  }

  if (state.started) return fail(state, 'started', 'This game has already started. Ask the host to start a new room.');
  if (state.players.length >= MAX_PLAYERS) return fail(state, 'full', `This room is full (${MAX_PLAYERS} players).`);
  const clean = cleanName(name);
  if (!clean) return fail(state, 'name', 'Type a name first.');
  if (nameTaken(state, clean)) return fail(state, 'name', `Someone is already called ${clean}. Try a different name.`);
  if (!VEHICLE_IDS.has(vehicle)) return fail(state, 'vehicle', 'Pick an icon.');
  if (vehicleTaken(state, vehicle)) return fail(state, 'vehicle', 'Someone just picked that icon. Choose another.');

  const player = { id: newId, token: newToken, name: clean, vehicle, joinedAt: now, connected: true, vote: null, answer: null };
  const s = touch({ ...state, players: [...state.players, player] }, now);
  return ok(s, [
    { to: player.id, msg: { t: 'joined', playerId: player.id, token: player.token, name: player.name, vehicle: player.vehicle } },
    ...rosterOut(s),
  ]);
}

// Change name or trophy while still in the lobby.
export function updateProfile(state, playerId, { name, vehicle }, now) {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return fail(state, 'unknown', 'You are not in this room.');
  if (state.started) return fail(state, 'started', 'You can only change your name or icon before the game starts.');
  const clean = name === undefined ? me.name : cleanName(name);
  const veh = vehicle === undefined ? me.vehicle : vehicle;
  if (!clean) return fail(state, 'name', 'Type a name first.');
  if (nameTaken(state, clean, playerId)) return fail(state, 'name', `Someone is already called ${clean}. Try a different name.`);
  if (!VEHICLE_IDS.has(veh)) return fail(state, 'vehicle', 'Pick an icon.');
  if (vehicleTaken(state, veh, playerId)) return fail(state, 'vehicle', 'Someone else has that icon. Choose another.');
  const players = state.players.map((p) => (p.id === playerId ? { ...p, name: clean, vehicle: veh } : p));
  const s = touch({ ...state, players }, now);
  return ok(s, [{ to: playerId, msg: { t: 'joined', playerId, token: me.token, name: clean, vehicle: veh } }, ...rosterOut(s)]);
}

// A phone's connection dropped. Keep the seat (and trophy) so they can rejoin.
export function disconnect(state, playerId, now) {
  if (!state.players.some((p) => p.id === playerId)) return ok(state);
  const players = state.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p));
  const s = touch({ ...state, players }, now);
  return ok(s, rosterOut(s));
}

// The player tapped "Leave", or the TV removed them. Frees the seat in the lobby.
export function removePlayer(state, playerId, now) {
  if (!state.players.some((p) => p.id === playerId)) return ok(state);
  const players = state.started
    ? state.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p))
    : state.players.filter((p) => p.id !== playerId);
  const s = touch({ ...state, players }, now);
  return ok(s, [{ to: playerId, msg: { t: 'removed' } }, ...rosterOut(s)]);
}

export function setLength(state, playerId, length, now) {
  if (playerId !== hostId(state)) return fail(state, 'host', 'Only the host can change the game length.');
  if (state.started) return fail(state, 'started', 'The game has already started.');
  if (!(length in LENGTHS)) return fail(state, 'length', 'Unknown game length.');
  const s = touch({ ...state, length }, now);
  return ok(s, rosterOut(s));
}

// Host taps Start on their phone, or the TV starts it (Play on the remote).
export function start(state, by, now) {
  if (by !== 'tv' && by !== hostId(state)) return fail(state, 'host', 'Only the host can start the game.');
  if (state.started) return fail(state, 'started', 'The game has already started.');
  const ready = state.players.filter((p) => p.connected).length;
  if (ready < MIN_PLAYERS) return fail(state, 'players', `You need at least ${MIN_PLAYERS} players to start.`);
  const s = touch({ ...state, started: true }, now);
  return ok(s, [
    { to: 'tv', msg: { t: 'start', length: s.length, rounds: LENGTHS[s.length], questionsPerRound: QUESTIONS_PER_ROUND } },
    ...rosterOut(s),
  ]);
}

// --- Phases sent by the TV -------------------------------------------------

function str(v, max = 300) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function cleanPhase(p) {
  if (!p || !PHASES.has(p.type)) return null;
  const base = { type: p.type };
  const durationMs = Number.isFinite(p.durationMs) ? Math.max(1000, Math.min(120000, p.durationMs)) : null;
  switch (p.type) {
    case 'vote': {
      const options = Array.isArray(p.options) ? p.options.slice(0, 4).map((o) => str(o, 60)) : [];
      if (options.length < 2) return null;
      return { ...base, round: p.round | 0, rounds: p.rounds | 0, options, durationMs: durationMs ?? 10000 };
    }
    case 'question': {
      const answers = Array.isArray(p.answers) ? p.answers.slice(0, 4).map((a) => str(a, 120)) : [];
      if (answers.length < 2) return null;
      return {
        ...base,
        round: p.round | 0,
        rounds: p.rounds | 0,
        question: p.question | 0,
        questions: p.questions | 0,
        category: str(p.category, 60),
        prompt: str(p.prompt, 400),
        answers,
        durationMs: durationMs ?? 20000,
      };
    }
    case 'reveal': {
      const results = {};
      if (p.results && typeof p.results === 'object') {
        for (const [id, r] of Object.entries(p.results)) {
          if (!r || typeof r !== 'object') continue;
          results[id] = { correct: !!r.correct, points: r.points | 0, total: r.total | 0, rank: r.rank | 0, fastest: !!r.fastest };
        }
      }
      return { ...base, correct: p.correct | 0, correctText: str(p.correctText, 120), note: str(p.note, 200), results };
    }
    case 'scores':
    case 'final': {
      const standings = Array.isArray(p.standings)
        ? p.standings.slice(0, MAX_PLAYERS).map((r) => ({ id: str(r.id, 40), total: r.total | 0, rank: r.rank | 0 }))
        : [];
      return { ...base, round: p.round | 0, rounds: p.rounds | 0, standings };
    }
    default:
      return base;
  }
}

// What a phone should see for the current phase (also used when a phone reconnects).
export function currentPhaseFor(state, playerId, now) {
  const ph = state.phase;
  if (!ph || ph.type === 'lobby') return null;
  const me = state.players.find((p) => p.id === playerId);
  const remainingMs = ph.endsAt ? Math.max(0, ph.endsAt - now) : null;
  const common = { t: 'phase', seq: ph.seq, type: ph.type };
  switch (ph.type) {
    case 'vote':
      return { ...common, round: ph.round, rounds: ph.rounds, options: ph.options, remainingMs, myVote: me ? me.vote : null };
    case 'question':
      return {
        ...common, round: ph.round, rounds: ph.rounds, question: ph.question, questions: ph.questions,
        category: ph.category, prompt: ph.prompt, answers: ph.answers, remainingMs,
        myAnswer: me && me.answer ? me.answer.choice : null,
      };
    case 'reveal':
      return {
        ...common, correct: ph.correct, correctText: ph.correctText, note: ph.note,
        myAnswer: me && me.answer ? me.answer.choice : null,
        me: (me && ph.results[me.id]) || null,
      };
    case 'scores':
    case 'final': {
      const mine = ph.standings.find((r) => r.id === playerId) || null;
      return { ...common, round: ph.round, rounds: ph.rounds, me: mine, players: ph.standings.length };
    }
    default:
      return common;
  }
}

export function tvPhase(state, phase, now) {
  const p = cleanPhase(phase);
  if (!p) return fail(state, 'phase', 'Bad phase from the TV.');
  const seq = (state.phase.seq || 0) + 1;
  const stamped = { ...p, seq, startedAt: now, endsAt: p.durationMs ? now + p.durationMs : null };
  let players = state.players;
  if (p.type === 'vote') players = players.map((x) => ({ ...x, vote: null }));
  if (p.type === 'question') players = players.map((x) => ({ ...x, answer: null }));
  const s = touch({ ...state, phase: stamped, players }, now);
  const out = s.players.map((pl) => ({ to: pl.id, msg: currentPhaseFor(s, pl.id, now) }));
  if (p.type === 'vote') out.push({ to: 'tv', msg: tallyMessage(s) });
  return ok(s, out);
}

function tallyMessage(state) {
  const tallies = state.phase.options.map(() => []);
  for (const p of state.players) if (p.vote !== null && p.vote < tallies.length) tallies[p.vote].push(p.id);
  return { t: 'votes', seq: state.phase.seq, tallies };
}

export function vote(state, playerId, choice, now) {
  const ph = state.phase;
  if (ph.type !== 'vote') return fail(state, 'phase', 'Voting is closed.');
  if (ph.endsAt && now > ph.endsAt + ANSWER_GRACE_MS) return fail(state, 'late', 'Time is up for voting.');
  if (!Number.isInteger(choice) || choice < 0 || choice >= ph.options.length) return fail(state, 'choice', 'Pick one of the categories.');
  if (!state.players.some((p) => p.id === playerId)) return fail(state, 'unknown', 'You are not in this room.');
  const players = state.players.map((p) => (p.id === playerId ? { ...p, vote: choice } : p));
  const s = touch({ ...state, players }, now);
  return ok(s, [{ to: 'tv', msg: tallyMessage(s) }, { to: playerId, msg: { t: 'voted', seq: ph.seq, choice } }]);
}

export function answer(state, playerId, choice, now) {
  const ph = state.phase;
  if (ph.type !== 'question') return fail(state, 'phase', 'There is no question open right now.');
  if (ph.endsAt && now > ph.endsAt + ANSWER_GRACE_MS) return fail(state, 'late', "Time's up for this question.");
  if (!Number.isInteger(choice) || choice < 0 || choice >= ph.answers.length) return fail(state, 'choice', 'Pick one of the answers.');
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return fail(state, 'unknown', 'You are not in this room.');
  if (me.answer) return fail(state, 'locked', 'Your answer is already locked in.');
  const ms = Math.max(0, now - ph.startedAt);
  const players = state.players.map((p) => (p.id === playerId ? { ...p, answer: { choice, ms } } : p));
  const s = touch({ ...state, players }, now);
  const answered = s.players.filter((p) => p.answer).length;
  return ok(s, [
    { to: 'tv', msg: { t: 'answer', seq: ph.seq, playerId, choice, ms, answered, of: s.players.filter((p) => p.connected).length } },
    { to: playerId, msg: { t: 'locked', seq: ph.seq, choice, ms } },
  ]);
}

// Back to the lobby with the same players (the TV's "Play again").
export function playAgain(state, now) {
  const players = state.players.map((p) => ({ ...p, vote: null, answer: null }));
  const s = touch({ ...state, started: false, phase: { type: 'lobby', seq: (state.phase.seq || 0) + 1 }, players }, now);
  return ok(s, [
    { to: 'tv', msg: { t: 'again' } },
    ...rosterOut(s),
    { to: 'players', msg: { t: 'phase', seq: s.phase.seq, type: 'lobby' } },
  ]);
}

// One entry point for messages from a phone.
export function fromPlayer(state, playerId, msg, now) {
  switch (msg && msg.t) {
    case 'profile': return updateProfile(state, playerId, msg, now);
    case 'length': return setLength(state, playerId, msg.length, now);
    case 'start': return start(state, playerId, now);
    case 'vote': return vote(state, playerId, msg.choice, now);
    case 'answer': return answer(state, playerId, msg.choice, now);
    case 'leave': return removePlayer(state, playerId, now);
    case 'again':
      if (playerId !== hostId(state)) return fail(state, 'host', 'Only the host can start another game.');
      if (state.phase.type !== 'final') return fail(state, 'phase', 'The game is still going.');
      return playAgain(state, now);
    default: return fail(state, 'message', 'Unknown message.');
  }
}

// One entry point for messages from the TV.
export function fromTv(state, msg, now) {
  switch (msg && msg.t) {
    case 'phase': return tvPhase(state, msg.phase, now);
    case 'start': return start(state, 'tv', now);
    case 'kick': return removePlayer(state, str(msg.playerId, 40), now);
    case 'again': return playAgain(state, now);
    case 'length':
      if (state.started || !(msg.length in LENGTHS)) return fail(state, 'length', 'Cannot change length now.');
      { const s = touch({ ...state, length: msg.length }, now); return ok(s, rosterOut(s)); }
    default: return fail(state, 'message', 'Unknown message.');
  }
}
