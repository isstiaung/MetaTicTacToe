# CLAUDE.md

Guidance for working in this repository.

## What this is

**MetaTicTacToe** is **Ultimate / Meta Tic-Tac-Toe**: a 3×3 grid of nine small tic-tac-toe
boards. Winning a small board claims that cell on the meta board; winning three claimed cells in
a line wins the game — and your move's cell position dictates which board your opponent must play
in next.

This repo is a **TypeScript monorepo**: one shared, framework-agnostic rules engine drives a
**web** app and a **React Native (Expo)** app. The original native-Android (Java) app is archived
under `android-old/`. Both apps support local 2-player, a vs-computer AI, and online (internet) PvP.

## Structure

```
MetaTicTacToe/
├─ package.json          # npm workspaces root (workspaces: packages/*)
├─ tsconfig.base.json    # shared TS compiler options
├─ CLAUDE.md             # this file
├─ progress.txt          # migration log (history; all steps complete)
├─ android-old/          # ARCHIVED original Java/Android app — do not develop here
├─ packages/
│  ├─ engine/            # @mtt/engine — pure TS rules + AI + vitest tests (NO UI imports)
│  ├─ theme/             # @mtt/theme — shared modern-minimal design tokens
│  ├─ protocol/          # @mtt/protocol — online wire types (types-only; reuses engine types)
│  └─ party/             # @mtt/party — authoritative PartyKit server (reuses @mtt/engine) + tests
├─ web/                  # Vite + React + TS  (standalone; aliases the shared packages)
└─ mobile/               # Expo React Native + TS, Android target (standalone; symlinks them)
```

## The engine is the single source of truth

All rules and AI live in `@mtt/engine` (`packages/engine/src`). **UIs must never re-implement game
logic** — they hold one `GameState` and replace it via the engine's immutable functions.

Public API (`packages/engine/src/index.ts`):
- Types: `Player` (`'X'|'O'`), `Cell` (`Player|null`), `Outcome` (`Player|'draw'|null`),
  `SubBoard` (`{cells: Cell[9]; winner: Outcome}`), `Move` (`{board; cell}`),
  `GameState` (`{boards: SubBoard[9]; currentPlayer; activeBoard: number|null; winner; lastMove}`),
  `Difficulty` (`'easy'|'hard'`).
- `createGame()` · `applyMove(state, board, cell)` (immutable, **throws on illegal move**) ·
  `getLegalMoves(state)` · `isLegalMove(state, board, cell)` · `allowedBoards(state)` ·
  `metaCells(state)` · `lineWinner(cells)` · `isFinished(subBoard)` · `other(player)` ·
  `chooseAiMove(state, difficulty?, rng?)` (`null` only when the game is over) · `LINES`.
- **Indexing:** sub-boards and cells are `0..8` row-major (`0` = top-left … `8` = bottom-right).

### Game rules (enforced by the engine)
- X moves first; turns alternate.
- A move in cell `i` routes the opponent to sub-board `i`. **Free-move exception:** if sub-board
  `i` is already finished, the opponent may play any unfinished board (`activeBoard === null`).
- A sub-board is won by 3-in-a-row; its winner claims that meta cell. Three claimed meta cells in
  a line wins the game; all boards finished with no line is a draw.
- AI: `easy` = mostly random (always grabs an immediate win) — beatable; `hard` = depth-limited
  minimax with alpha-beta + a node budget, so moves stay fast.

These rules are a faithful TS port of the original Android `Board.java` / `EntireBoard.java`.

## Design

`@mtt/theme` (`packages/theme/src/tokens.ts`) holds the **modern-minimal** language — cool off-white
paper, indigo X / emerald O, soft cool shadows, rounded cards, big X/O glyphs, ~120–260ms motion.
The active board glows; non-playable boards dim; finished boards fade with a translucent winner
glyph. **Evolve the look here once** — both apps consume these tokens, so changes propagate.

## How the apps consume the shared packages

The packages are **source-only** (`main` → `src/index.ts`, no build step). `web/` and `mobile/`
are **standalone** npm projects (their own `node_modules`), not workspace members — this sidesteps
Metro's monorepo-hoisting pain. They reference `@mtt/engine` / `@mtt/theme` by **path alias** to
the TS source:
- **web** — `vite.config.ts` `resolve.alias` + `server.fs.allow` (repo root); `tsconfig` `paths`.
- **mobile** — `metro.config.js` `watchFolders` = repo root + `extraNodeModules`, plus a
  `postinstall` (`scripts/link-shared.js`) that symlinks the packages into `mobile/node_modules`
  (Expo scopes Metro's server to the app root, so the symlink is required); `tsconfig` `paths`.

## Online play (internet PvP)

Online matches use an **authoritative server that reuses `@mtt/engine`** — the same rules run
server-side, so clients can't cheat or desync. Transport is WebSockets via **PartyKit** (one
"party" = one match room, keyed by a short room code).

- **`@mtt/protocol`** is the shared wire contract (`ClientMessage` / `ServerMessage`, reusing the
  engine's `GameState`). The server and both clients import it.
- **`@mtt/party`** (`packages/party`) is the server: `src/room.ts` is a **pure, unit-tested
  reducer** (seat assignment + reclaim-by-`playerId`, turn + legality via the engine, rematch,
  disconnect); `src/server.ts` is a thin PartyKit adapter with storage-backed rooms. First joiner =
  X, second = O, a third is rejected (`room_full`). The server is the **only writer** of
  `GameState`; clients render the broadcast `sync` and never call `applyMove` online.
- **Clients**: each app has a `useOnlineGame` hook (`web/src/online`, `mobile/src/online`) over
  `partysocket` (auto-reconnect — covers backgrounded phones). Players set a display name and get a
  stable anonymous `playerId`, persisted locally (localStorage / AsyncStorage). The board
  components are reused unchanged; online just feeds server state and locks input off-turn.
- **Host config:** web reads `VITE_PARTYKIT_HOST` (default `127.0.0.1:1999`); mobile reads
  `app.json` `extra.partykitHost`. Local dev: web / iOS-sim use `127.0.0.1:1999`, the **Android
  emulator** uses `10.0.2.2:1999`, a **physical device** uses the dev machine's LAN IP. Deploy with
  `npm run deploy -w @mtt/party` (owner's PartyKit login) and point the host at the `*.partykit.dev`
  URL.

Scoped out for now: random matchmaking, accounts, spectators, chat, match history.

## Commands

| Task | Command |
| --- | --- |
| Install root (shared packages) | `npm install` |
| Tests (engine + party) | `npm test` |
| Typecheck all packages | `npm run typecheck` |
| Online server — dev / deploy | `npm run dev -w @mtt/party` (→ `127.0.0.1:1999`) · `npm run deploy -w @mtt/party` |
| Web — dev / build | `cd web && npm run dev` · `npm run build` |
| Mobile — dev / Android | `cd mobile && npx expo start` · `npx expo start --android` |
| Mobile — typecheck / bundle check | `cd mobile && npm run typecheck` · `npx expo export --platform android` |

After any `npm install` in `mobile/`, the shared-package symlinks are recreated by `postinstall`
(or run `npm run link-shared`). Running on a real device/emulator is a local step (Android SDK).

## Conventions

- TypeScript everywhere. Keep `@mtt/engine` framework-agnostic (no React/DOM/RN imports) so it runs
  in web, React Native, tests, and a worker.
- Treat `android-old/` as read-only history; new work goes in `packages/`, `web/`, `mobile/`.
- Add or change a rule? Do it in `@mtt/engine` with a vitest test, then let the UIs use it.
