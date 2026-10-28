# Reel Rivals · Party Night

The online half of the Reel Rivals Apple TV party game. It runs on Cloudflare at **reelrivals.app**.

- **Phone page** (`public/index.html`): players join with the room code from the TV (or by scanning its QR code), pick a name and a trophy vehicle, vote on categories and answer questions. No app download.
- **Room service** (`src/`): a Cloudflare Worker plus one Durable Object per room. It keeps the player list, stamps answer times, and relays messages between the TV and the phones. The Apple TV app runs the game itself (questions, timer, scoring).

## How it fits together

```
Apple TV app  ── WebSocket ──►  Room (Durable Object, named by its 4-letter code)  ◄── WebSocket ──  phones (reelrivals.app)
```

| Address | What it does |
| --- | --- |
| `POST /api/rooms` | The TV asks for a new room. Returns `{ code, tvKey }`. |
| `GET /api/rooms/ABCD` | Does room ABCD exist, has it started, is it full, which trophies are taken. |
| `GET /api/rooms/ABCD/ws?role=tv&key=…` | The TV's live connection (needs the `tvKey`). |
| `GET /api/rooms/ABCD/ws?role=player` | A phone's live connection. |
| everything else | The phone page and images in `public/`. |

### Messages

Phone → room: `join {name, vehicle}` or `join {playerId, token}` to rejoin · `profile {name, vehicle}` · `length {length}` (host) · `start` (host) · `vote {choice}` · `answer {choice}` · `leave` · `ping`

TV → room: `phase {phase}` · `start` · `length {length}` · `kick {playerId}` · `again`

A `phase` from the TV is one of:
- `{type:'vote', round, rounds, options:[3 categories], durationMs}`
- `{type:'question', round, rounds, question, questions, category, prompt, answers:[4], durationMs}` (never include the correct answer)
- `{type:'reveal', correct, correctText, note, results:{playerId:{correct, points, total, rank, fastest}}}`
- `{type:'scores' | 'final', round, rounds, standings:[{id, total, rank}]}`

Room → TV: `hello` / `lobby` (players, host, length) · `start {length, rounds, questionsPerRound}` · `votes {tallies}` · `answer {playerId, choice, ms, answered, of}`

Room → phone: `hello` · `joined {playerId, token, name, vehicle}` · `lobby` · `phase` (each phone only sees its own result) · `voted` · `locked` · `removed` · `error {code, message}`

### Game rules enforced here
2–10 players · one trophy per player (all 49 vehicles) · names up to 12 letters, no duplicates · the first player to join is the host (if they drop, the next connected player takes over) · Quick 3 / Standard 5 / Marathon 8 rounds of 4 questions · answers lock on first tap and are timed by the server · no new players after the game starts, but dropped phones can rejoin · rooms are forgotten 6 hours after their last activity.

## Checking it

```
npm test                    # rules + a simulated full game (no Cloudflare needed)
node test/devserver.mjs     # try the phone page at http://localhost:8787
```

## Publishing

Cloudflare publishes this project automatically from GitHub whenever `main` changes (Workers Builds). The settings are in `wrangler.jsonc`.
