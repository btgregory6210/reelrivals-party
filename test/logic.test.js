import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/logic.js';

let n = 0;
const id = () => `p${++n}`;
const tok = () => `t${n}`;

function joinOk(state, name, vehicle, now = 1000) {
  const r = L.join(state, { name, vehicle }, now, id(), tok());
  assert.equal(r.error, null, r.error && r.error.message);
  return r.state;
}

function room() {
  return L.newRoom('KRMV', 'tvkey', 0);
}

test('room codes use only consonants and are 4 letters', () => {
  for (let i = 0; i < 500; i++) {
    const c = L.randomCode();
    assert.ok(L.isValidCode(c), c);
  }
  assert.equal(L.isValidCode('KRMA'), false); // vowel
  assert.equal(L.isValidCode('krmv'), false);
  assert.equal(L.isValidCode('KRM'), false);
});

test('join: first player is host, players get roster updates', () => {
  let s = room();
  const r = L.join(s, { name: '  Brandon ', vehicle: 'trex' }, 5, 'a', 'SECRET-TOKEN-a');
  assert.equal(r.error, null);
  assert.equal(r.state.players[0].name, 'Brandon');
  assert.equal(L.hostId(r.state), 'a');
  const joined = r.out.find((o) => o.to === 'a' && o.msg.t === 'joined');
  assert.equal(joined.msg.token, 'SECRET-TOKEN-a');
  assert.ok(r.out.some((o) => o.to === 'tv' && o.msg.t === 'lobby'));
  assert.ok(r.out.some((o) => o.to === 'players' && o.msg.t === 'lobby'));
  // The roster sent to everyone never leaks rejoin tokens.
  for (const o of r.out.filter((x) => x.msg.t === 'lobby')) {
    assert.equal(JSON.stringify(o.msg).includes('SECRET-TOKEN'), false);
  }
});

test('join: rejects duplicate trophy, duplicate name, bad trophy, empty name', () => {
  let s = joinOk(room(), 'Brandon', 'trex');
  assert.equal(L.join(s, { name: 'Maya', vehicle: 'trex' }, 1, id(), tok()).error.code, 'vehicle');
  assert.equal(L.join(s, { name: 'brandon', vehicle: 'rocket' }, 1, id(), tok()).error.code, 'name');
  assert.equal(L.join(s, { name: 'Maya', vehicle: 'spaceship' }, 1, id(), tok()).error.code, 'vehicle');
  assert.equal(L.join(s, { name: '   ', vehicle: 'rocket' }, 1, id(), tok()).error.code, 'name');
});

test('join: names are trimmed to 12 characters with no control characters', () => {
  assert.equal(L.cleanName('A\u0007very  long   name indeed'), 'A very long');
  assert.equal(L.cleanName(42), '');
});

test('join: room holds 10 players, then says it is full', () => {
  let s = room();
  const vs = ['jeep', 'train', 'musclecar', 'stagecoach', 'trex', 'broom', 'tank', 'rocket', 'chariot', 'speedboat'];
  vs.forEach((v, i) => { s = joinOk(s, `P${i}`, v); });
  assert.equal(s.players.length, 10);
  assert.equal(L.join(s, { name: 'Late', vehicle: 'saucer' }, 1, id(), tok()).error.code, 'full');
});

test('rejoin needs the private token; wrong token is treated as a new join', () => {
  let s = room();
  let r = L.join(s, { name: 'Maya', vehicle: 'rocket' }, 1, 'm', 'secret');
  s = L.disconnect(r.state, 'm', 2).state;
  assert.equal(s.players[0].connected, false);
  // Someone else guessing the id but not the token cannot take the seat.
  const fake = L.join(s, { name: 'Maya', vehicle: 'rocket', playerId: 'm', token: 'nope' }, 3, 'x', 'tx');
  assert.equal(fake.error.code, 'name');
  const back = L.join(s, { playerId: 'm', token: 'secret' }, 4, 'unused', 'unused');
  assert.equal(back.error, null);
  assert.equal(back.state.players.length, 1);
  assert.equal(back.state.players[0].connected, true);
});

test('rejoin works after the game has started and resumes the current question', () => {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  s = L.join(s, { name: 'B', vehicle: 'train' }, 1, 'b', 'tb').state;
  s = L.start(s, 'a', 2).state;
  s = L.tvPhase(s, { type: 'question', round: 1, rounds: 5, question: 1, questions: 4, prompt: 'Q?', answers: ['w', 'x', 'y', 'z'], durationMs: 20000 }, 10).state;
  s = L.disconnect(s, 'b', 11).state;
  // New players cannot join mid-game...
  assert.equal(L.join(s, { name: 'C', vehicle: 'tank' }, 12, 'c', 'tc').error.code, 'started');
  // ...but B can come back and lands on the open question with the right time left.
  const r = L.join(s, { playerId: 'b', token: 'tb' }, 5010, '', '');
  assert.equal(r.error, null);
  const resume = r.out.find((o) => o.to === 'b' && o.msg.t === 'phase');
  assert.equal(resume.msg.type, 'question');
  assert.equal(resume.msg.remainingMs, 15000);
});

test('host moves to the next connected player when the host drops', () => {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  s = L.join(s, { name: 'B', vehicle: 'train' }, 2, 'b', 'tb').state;
  assert.equal(L.hostId(s), 'a');
  s = L.disconnect(s, 'a', 3).state;
  assert.equal(L.hostId(s), 'b');
  s = L.join(s, { playerId: 'a', token: 'ta' }, 4, '', '').state;
  assert.equal(L.hostId(s), 'a');
});

test('profile change in the lobby; trophy must stay unique', () => {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  s = L.join(s, { name: 'B', vehicle: 'train' }, 1, 'b', 'tb').state;
  assert.equal(L.updateProfile(s, 'b', { vehicle: 'jeep' }, 2).error.code, 'vehicle');
  const r = L.updateProfile(s, 'b', { name: 'Bea', vehicle: 'whale' }, 2);
  assert.equal(r.error, null);
  assert.deepEqual([r.state.players[1].name, r.state.players[1].vehicle], ['Bea', 'whale']);
});

test('leaving in the lobby frees the trophy', () => {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  s = L.join(s, { name: 'B', vehicle: 'train' }, 1, 'b', 'tb').state;
  s = L.removePlayer(s, 'b', 2).state;
  assert.equal(s.players.length, 1);
  assert.equal(L.join(s, { name: 'C', vehicle: 'train' }, 3, 'c', 'tc').error, null);
});

test('only the host sets length and starts; needs 2 connected players', () => {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  assert.equal(L.start(s, 'a', 2).error.code, 'players');
  s = L.join(s, { name: 'B', vehicle: 'train' }, 1, 'b', 'tb').state;
  assert.equal(L.setLength(s, 'b', 'quick', 2).error.code, 'host');
  assert.equal(L.setLength(s, 'a', 'forever', 2).error.code, 'length');
  s = L.setLength(s, 'a', 'marathon', 2).state;
  assert.equal(L.start(s, 'b', 3).error.code, 'host');
  const r = L.start(s, 'a', 3);
  assert.equal(r.error, null);
  const toTv = r.out.find((o) => o.to === 'tv' && o.msg.t === 'start').msg;
  assert.deepEqual([toTv.length, toTv.rounds, toTv.questionsPerRound], ['marathon', 8, 4]);
  assert.equal(L.start(r.state, 'a', 4).error.code, 'started');
});

test('the TV can start the game (Play on the remote)', () => {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  s = L.join(s, { name: 'B', vehicle: 'train' }, 1, 'b', 'tb').state;
  assert.equal(L.fromTv(s, { t: 'start' }, 2).error, null);
});

function started() {
  let s = room();
  s = L.join(s, { name: 'A', vehicle: 'jeep' }, 1, 'a', 'ta').state;
  s = L.join(s, { name: 'B', vehicle: 'train' }, 1, 'b', 'tb').state;
  s = L.join(s, { name: 'C', vehicle: 'tank' }, 1, 'c', 'tc').state;
  return L.start(s, 'a', 2).state;
}

test('voting: change your vote until time is up; TV sees tallies', () => {
  let s = started();
  let r = L.tvPhase(s, { type: 'vote', round: 1, rounds: 5, options: ['Famous Quotes', 'Horror', 'Pixar'], durationMs: 10000 }, 100);
  s = r.state;
  assert.equal(r.out.filter((o) => o.msg && o.msg.t === 'phase').length, 3);
  s = L.vote(s, 'a', 0, 200).state;
  s = L.vote(s, 'b', 0, 300).state;
  r = L.vote(s, 'a', 2, 400);
  s = r.state;
  const tallies = r.out.find((o) => o.to === 'tv').msg.tallies;
  assert.deepEqual(tallies, [['b'], [], ['a']]);
  assert.equal(L.vote(s, 'c', 5, 500).error.code, 'choice');
  assert.equal(L.vote(s, 'c', 1, 100 + 10000 + L.ANSWER_GRACE_MS + 1).error.code, 'late');
});

test('answers: one per question, timed by the server, late answers refused', () => {
  let s = started();
  s = L.tvPhase(s, { type: 'question', round: 1, rounds: 5, question: 1, questions: 4, category: 'Oscars', prompt: 'Best Picture 1998?', answers: ['Titanic', 'Good Will Hunting', 'As Good as It Gets', 'L.A. Confidential'], durationMs: 20000 }, 1000).state;
  let r = L.answer(s, 'a', 0, 6400);
  assert.equal(r.error, null);
  const toTv = r.out.find((o) => o.to === 'tv').msg;
  assert.deepEqual([toTv.playerId, toTv.choice, toTv.ms, toTv.answered, toTv.of], ['a', 0, 5400, 1, 3]);
  s = r.state;
  assert.equal(L.answer(s, 'a', 1, 6500).error.code, 'locked');
  assert.equal(L.answer(s, 'b', 1, 1000 + 20000 + L.ANSWER_GRACE_MS + 1).error.code, 'late');
  assert.equal(L.answer(s, 'b', 9, 7000).error.code, 'choice');
  // A new question clears the locks.
  s = L.tvPhase(s, { type: 'question', round: 1, rounds: 5, question: 2, questions: 4, prompt: 'Next', answers: ['1', '2'], durationMs: 20000 }, 30000).state;
  assert.equal(L.answer(s, 'a', 1, 31000).error, null);
});

test('answers outside a question are refused', () => {
  const s = started();
  assert.equal(L.answer(s, 'a', 0, 10).error.code, 'phase');
  assert.equal(L.vote(s, 'a', 0, 10).error.code, 'phase');
});

test('reveal: each phone only gets its own result', () => {
  let s = started();
  s = L.tvPhase(s, { type: 'question', prompt: 'Q', answers: ['w', 'x'], durationMs: 5000 }, 0).state;
  s = L.answer(s, 'a', 0, 1000).state;
  const r = L.tvPhase(s, {
    type: 'reveal', correct: 0, correctText: 'Titanic', note: 'Won 11 Oscars.',
    results: { a: { correct: true, points: 860, total: 2840, rank: 1, fastest: true }, b: { correct: false, points: 0, total: 1980, rank: 2 } },
  }, 6000);
  const toA = r.out.find((o) => o.to === 'a').msg;
  const toB = r.out.find((o) => o.to === 'b').msg;
  const toC = r.out.find((o) => o.to === 'c').msg;
  assert.equal(toA.me.points, 860);
  assert.equal(toA.myAnswer, 0);
  assert.equal(toB.me.correct, false);
  assert.equal(toB.myAnswer, null);
  assert.equal(toC.me, null);
  assert.equal(JSON.stringify(toA).includes('1980'), false);
});

test('question phases never send the correct answer to phones', () => {
  let s = started();
  const r = L.tvPhase(s, { type: 'question', prompt: 'Q', answers: ['w', 'x'], correct: 1, durationMs: 5000 }, 0);
  for (const o of r.out) assert.equal('correct' in o.msg, false);
});

test('bad phases from the TV are rejected and long text is cut', () => {
  const s = started();
  assert.equal(L.tvPhase(s, { type: 'dance' }, 0).error.code, 'phase');
  assert.equal(L.tvPhase(s, { type: 'question', answers: ['only one'] }, 0).error.code, 'phase');
  const r = L.tvPhase(s, { type: 'question', prompt: 'x'.repeat(5000), answers: ['a', 'b'], durationMs: 999999999 }, 0);
  assert.equal(r.state.phase.prompt.length, 400);
  assert.equal(r.state.phase.durationMs, 120000);
});

test('play again returns everyone to the lobby with the same seats', () => {
  let s = started();
  s = L.tvPhase(s, { type: 'final', standings: [{ id: 'a', total: 100, rank: 1 }] }, 10).state;
  const r = L.fromTv(s, { t: 'again' }, 20);
  assert.equal(r.state.started, false);
  assert.equal(r.state.players.length, 3);
  assert.equal(r.state.phase.type, 'lobby');
});

test('unknown messages get a friendly error, not a crash', () => {
  const s = started();
  assert.equal(L.fromPlayer(s, 'a', { t: 'hack' }, 0).error.code, 'message');
  assert.equal(L.fromPlayer(s, 'a', null, 0).error.code, 'message');
  assert.equal(L.fromTv(s, { t: 'hack' }, 0).error.code, 'message');
});

test('the host can start another game from their phone, but only at the end', () => {
  let s = started();
  assert.equal(L.fromPlayer(s, 'a', { t: 'again' }, 5).error.code, 'phase');
  s = L.tvPhase(s, { type: 'final', standings: [{ id: 'a', total: 100, rank: 1 }] }, 10).state;
  assert.equal(L.fromPlayer(s, 'b', { t: 'again' }, 11).error.code, 'host');
  const r = L.fromPlayer(s, 'a', { t: 'again' }, 12);
  assert.equal(r.error, null);
  assert.equal(r.state.started, false);
  assert.ok(r.out.some((o) => o.to === 'tv' && o.msg.t === 'again'));
});

test('type-in questions: phones send a typed guess, the TV gets it, no choices are sent', () => {
  let s = started();
  const r0 = L.tvPhase(s, { type: 'question', typed: true, prompt: 'Name this movie', answers: ['Jaws', 'JAWS'], hint: 'Type the title', durationMs: 20000 }, 0);
  s = r0.state;
  const toA = r0.out.find((o) => o.to === 'a').msg;
  assert.equal(toA.typed, true);
  assert.deepEqual(toA.answers, [], 'accepted spellings must never reach phones');
  assert.equal(toA.hint, 'Type the title');
  assert.equal(L.answer(s, 'a', null, 100, '   ').error.code, 'choice');
  const r = L.answer(s, 'a', null, 1500, '  jaws  ');
  assert.equal(r.error, null);
  const toTv = r.out.find((o) => o.to === 'tv').msg;
  assert.deepEqual([toTv.text, toTv.ms, 'choice' in toTv], ['jaws', 1500, false]);
  assert.equal(L.answer(r.state, 'a', null, 1600, 'Alien').error.code, 'locked');
  s = L.tvPhase(r.state, { type: 'reveal', typed: true, correct: 0, correctText: 'Jaws', results: { a: { correct: true, points: 900, total: 900, rank: 1 } } }, 3000).state;
  const resume = L.currentPhaseFor(s, 'a', 3001);
  assert.deepEqual([resume.typed, resume.myText, resume.me.correct], [true, 'jaws', true]);
});
