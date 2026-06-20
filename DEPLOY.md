# Deploying MetaTicTacToe

Three deployables, in order — the clients bake in the server host, so **deploy the server
first**. Everything here fits free hobby tiers (the only optional cost is the Play Store's
one-time $25, and only when you ship mobile).

```
1. Workers server   ──▶  wss://metatictactoe.<account>.workers.dev
2. Web app          ──▶  static site (Cloudflare Pages); server host baked in at BUILD time
3. Mobile app       ──▶  later
```

## 1. Server — Cloudflare Workers (deploy first)

The authoritative game server (`@mtt/party`) runs on **Cloudflare Workers + Durable Objects**
(via [`partyserver`](https://github.com/cloudflare/partykit/tree/main/packages/partyserver)).
Deploys to your own Cloudflare account — free, no custom domain needed.

```bash
npx wrangler login            # opens a browser; authorize Cloudflare
npm run deploy -w @mtt/party  # = wrangler deploy (config in packages/party/wrangler.jsonc)
```

You'll get a host like **`metatictactoe.<account>.workers.dev`** (HTTPS + WSS included). Use that
as the host value for the clients below. Durable Objects (SQLite-backed, with hibernation) are on
the free plan, so idle rooms cost ~nothing.

Local dev: `npm run dev -w @mtt/party` runs `wrangler dev` on `127.0.0.1:1999` (matching the
clients' default host).

> Why not the hosted `*.partykit.dev`? That shared zone has hit Cloudflare's custom-domain limit,
> so new projects can't deploy there — running on your own Workers account is the supported path
> and is free. The game logic (`room.ts`) and both clients are unchanged.

## 2. Web — Cloudflare Pages

Static Vite build that auto-deploys on push to `main`.

**Cloudflare → Pages → Create project → connect this repo**, then set:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `web` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_PARTYKIT_HOST` = `metatictactoe.<account>.partykit.dev` |

`VITE_PARTYKIT_HOST` is read at **build time** (Vite inlines it), so it must be set in the Pages
environment — see [`web/.env.example`](web/.env.example). Pages checks out the whole repo, so the
`../packages/*` source the web app aliases is available during the build.

Result: `https://<project>.pages.dev` over HTTPS, so the `wss://` connection to the server matches.

Local production-style build:

```bash
cd web
VITE_PARTYKIT_HOST=metatictactoe.<account>.partykit.dev npm run build
```

## 3. Mobile — later

Not deployed yet. When ready: set `mobile/app.json` → `expo.extra.partykitHost` to the deployed
host, then build with EAS (`eas build -p android --profile preview` for a shareable APK, or
`--profile production` + Play Store). EAS must see the monorepo root so `packages/*` resolve
(metro `watchFolders` + the `postinstall` symlink) — follow Expo's monorepo guide, or add `web`
and `mobile` to the root `workspaces` so EAS's built-in monorepo support handles it.

## Wiring recap

The server host flows into the web build env (`VITE_PARTYKIT_HOST`) and, later, mobile
`app.json` `extra.partykitHost`. When the server URL changes, update it in those places.

## CI

`.github/workflows/ci.yml` runs the engine + server tests, typechecks all packages, and builds
the web app on every push / PR — a safety net before anything deploys.
