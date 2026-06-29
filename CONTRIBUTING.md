# Contributing to MetaTicTacToe

Thanks for your interest in contributing! MetaTicTacToe is **Ultimate / Meta Tic-Tac-Toe** — a
TypeScript monorepo with one shared, framework-agnostic rules engine driving a **web** app and a
**React Native (Expo)** app, plus an authoritative online server on Cloudflare Workers.

By contributing you agree that your contributions are licensed under the project's
[GPL-3.0-or-later](LICENSE).

## The golden rule: the engine is the single source of truth

All game rules and AI live in [`@mtt/engine`](packages/engine) (`packages/engine/src`). **UIs must
never re-implement game logic** — they hold one `GameState` and replace it via the engine's immutable
functions. If you add or change a rule:

1. Make the change in `@mtt/engine`.
2. Add or update a [vitest](https://vitest.dev) test for it (`packages/engine/src/*.test.ts`).
3. Let the web and mobile apps consume the new behavior — don't duplicate it in the UI.

Keep `@mtt/engine` framework-agnostic: **no React, DOM, or React Native imports**, so it runs in the
web, mobile, tests, and the Cloudflare Worker alike.

## Project layout

```
packages/engine     @mtt/engine   — pure TS rules + AI + tests (no UI imports)
packages/theme      @mtt/theme    — shared modern-minimal design tokens
packages/protocol   @mtt/protocol — online wire types (reuses engine types)
packages/party      @mtt/party    — Cloudflare Workers game server + tests
web/                Vite + React + TS web app
mobile/             Expo React Native app (Android target)
android-old/        ARCHIVED original Java/Android app — read-only history, do not develop here
```

See [`CLAUDE.md`](CLAUDE.md) for a deeper architecture tour (engine API, indexing, online design).

## Development setup

Requires **Node.js 18+**.

```bash
# 1. Shared packages (engine, theme, protocol, party) + tests/typecheck
npm install
npm test            # engine + party vitest suites
npm run typecheck   # typecheck all shared packages

# 2. Web app (standalone — its own node_modules)
cd web
npm install
npm run dev         # http://localhost:5173
npm run build

# 3. Mobile app (standalone — its own node_modules)
cd ../mobile
npm install         # postinstall symlinks the shared packages (scripts/link-shared.js)
npm run typecheck
npx expo start      # press 'a' for Android (needs Android SDK)
```

> `web/` and `mobile/` are **not** workspace members — they're standalone npm projects that reference
> the shared packages by path alias / symlink. After any `npm install` in `mobile/`, the symlinks are
> recreated by `postinstall` (or run `npm run link-shared`).

### Running online play locally

```bash
npm run dev -w @mtt/party   # local game server at 127.0.0.1:1999
```

No secrets or accounts are needed for local development — the abuse gate (Turnstile + session tokens)
is **fail-open and disabled until its secrets are set**, so online play works out of the box locally.
See [`DEPLOY.md`](DEPLOY.md) for the production setup.

## Before you open a PR

- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] If you touched the web app: `npm run build --prefix web` succeeds.
- [ ] If you touched the mobile app: `npm run typecheck --prefix mobile` succeeds.
- [ ] Rule/AI changes were made in `@mtt/engine` and covered by a vitest test.
- [ ] New source files carry the SPDX header: `// SPDX-License-Identifier: GPL-3.0-or-later`.

CI runs these same checks on every PR (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Commit & branch conventions

- **Target `main`** with your PR. (`deploy-app` is the auto-deploy branch — don't target it.)
- Use **[Conventional Commits](https://www.conventionalcommits.org/)**, matching the existing history:
  - `feat(web): live per-player match stats panel`
  - `fix(online): mint Turnstile session token on the share-link join path`
  - Common scopes: `engine`, `web`, `mobile`, `online`, `party`, `theme`.
- Keep PRs focused; describe the change and include screenshots / screen recordings for UI work.

## Reporting bugs & requesting features

Open an issue using the templates in [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE). For questions
and ideas, use [Discussions](../../discussions). For **security issues, do not open a public issue** —
see [`SECURITY.md`](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to
uphold it.
