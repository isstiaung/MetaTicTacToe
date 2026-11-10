# MetaTicTacToe

**Ultimate / Meta Tic-Tac-Toe** — nine tic-tac-toe boards inside one big board, where your move decides where your opponent must play next. Built as a TypeScript monorepo: one shared game engine powering a **web** app and a **React Native (Expo)** app, with local 2-player, a vs-computer AI, and online PvP.

### ▶️ Play now: **[mttt.isstiaung.me](https://mttt.isstiaung.me)** — free, no sign-up

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-000020?logo=expo&logoColor=white)
![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

> This started life as a native Android (Java) app and was rewritten as a shared-engine web + mobile codebase.

## How to play

You play on a 3×3 grid of nine small tic-tac-toe boards.

- **X** always moves first; turns alternate.
- The **cell** you play in decides **which board** your opponent must play in next. Play the top-right cell → they must play in the top-right board.
- **Free move:** if you're sent to a board that's already finished, you may play in **any** open board.
- Win a small board to **claim** that square on the big board. Get **three claimed squares in a row** to win the game.
- All boards finished with no line → it's a **draw**.

📖 Full rules: <https://isstiaung.me/meta-tictactoe-rules-6ac9bc68d079>

## Features

- 🎮 **Local 2-player** (pass-and-play) on web and mobile
- 🤖 **Vs-computer** with Easy and Hard difficulty (iterative-deepening minimax + alpha-beta)
- 🌐 **Online PvP** — play a friend over the internet via a shareable link or room code (authoritative server, reconnect, rematch with sides swapped, claim the win if your opponent leaves)
- 🧠 **One shared rules engine** — web, mobile, and the server can never disagree on the rules
- 🎨 **Modern-minimal design** from a shared token system; the active board glows, finished boards fade
- ♿ Accessible and responsive web client (keyboard play, focus management, reduced-motion)

## Repository layout

```
MetaTicTacToe/
├─ packages/
│  ├─ engine/   # @mtt/engine   — pure-TS rules + AI (no UI), with vitest tests
│  ├─ theme/    # @mtt/theme    — shared modern-minimal design tokens
│  ├─ protocol/ # @mtt/protocol — online wire types (shared by server + clients)
│  └─ party/    # @mtt/party    — Cloudflare Workers server (partyserver, reuses the engine)
├─ web/         # Vite + React + TypeScript
├─ mobile/      # Expo (React Native) + TypeScript, Android target
└─ CLAUDE.md    # contributor / agent guide (deep detail)
```

`web/` and `mobile/` are standalone apps that consume the shared packages by **path alias to their TypeScript source** — no build step for the shared code. See [`CLAUDE.md`](CLAUDE.md) for the wiring details.

## Getting started

**Prerequisites:** Node.js 20+ and npm. For the mobile app, the [Expo](https://docs.expo.dev/) tooling (`npx expo`), plus an Android emulator or the Expo Go app to run on a device.

```bash
git clone git@github.com:isstiaung/MetaTicTacToe.git
cd MetaTicTacToe
npm install        # installs the shared packages (engine, theme, protocol, party)
npm test           # run the engine, protocol and server test suites
```

### Run the web app

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to web/dist
```

### Run the mobile app

```bash
cd mobile
npm install        # also symlinks the shared packages (postinstall)
npx expo start             # then press "a" for Android, or scan with Expo Go
npx expo start --android   # launch straight to an emulator/device
npm run typecheck
```

### Engine tests & types

```bash
npm test           # vitest (rules, routing + free-move, win/draw, AI, room codes, server)
npm run typecheck  # typecheck all shared packages
```

## Online multiplayer

Online matches run through a small **authoritative server that reuses `@mtt/engine`** (so the rules
can't be cheated or desynced), over WebSockets on **Cloudflare Workers + Durable Objects** (via
[partyserver](https://github.com/cloudflare/partykit/tree/main/packages/partyserver)) — one room
per match, keyed by a shareable code. Players set a display name; reconnect and rematch are built in.

Run the server locally:

```bash
npm run dev -w @mtt/party     # serves ws://127.0.0.1:1999
npm test -w @mtt/party        # server-logic tests
```

Point the clients at it:
- **Web** — `VITE_PARTYKIT_HOST` (defaults to `127.0.0.1:1999`). Open two tabs → Create in one, Join with the code in the other.
- **Mobile** — `app.json` → `expo.extra.partykitHost`. Web / iOS-sim use `127.0.0.1:1999`, the **Android emulator** uses `10.0.2.2:1999`, and a **physical device** needs the dev machine's LAN IP.

Deploy to your own Cloudflare account (free) with `npm run deploy -w @mtt/party` (`wrangler deploy`),
then set the host values to the resulting `*.workers.dev` URL. See [`DEPLOY.md`](DEPLOY.md).

> **Forking?** `packages/party/wrangler.jsonc` and `web/wrangler.jsonc` route to this project's own
> domains (`party.mttt.isstiaung.me`, `mttt.isstiaung.me`). Change or remove their `routes` before
> deploying to your account, or the deploy fails on a zone you don't own.

## Architecture

The heart of the project is **`@mtt/engine`** — a small, pure, framework-agnostic TypeScript module that owns all the rules and the AI. It exposes an immutable `GameState` and functions like `createGame`, `applyMove` (throws on illegal moves), `getLegalMoves`, `isLegalMove`, and `chooseAiMove`. Both UIs hold one `GameState` and replace it via the engine — they never re-implement the rules.

Because the engine has no UI or platform dependencies, the **same code** runs in the browser, in React Native, in tests, in a Web Worker (the web app's AI), and on the online game server.

The look comes from **`@mtt/theme`**, a single set of design tokens (palette, spacing, type, motion, shadows) shared by both apps, so the design stays consistent and evolves from one place.

## Roadmap

- 🤝 **Random matchmaking** — quick-match with a stranger (online play today is private room codes)
- 🏆 Match history / simple accounts
- 🎚️ More AI difficulty tuning

## The original Android app

The first version of MetaTicTacToe was a native Android app written in Java; it's no longer maintained, and the rules in `@mtt/engine` are a faithful port of its logic.

## License

[**GPL-3.0-or-later**](LICENSE). MetaTicTacToe is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but **without any warranty** — see the [`LICENSE`](LICENSE) file for the full text.
