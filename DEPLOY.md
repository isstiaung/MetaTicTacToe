# Deploying MetaTicTacToe

Three deployables, in order — the clients bake in the server host, so **deploy the server
first**. Everything here fits free hobby tiers (the only optional cost is the Play Store's
one-time $25, and only when you ship mobile).

```
1. Workers server   ──▶  wss://metatictactoe.<account>.workers.dev
2. Web app          ──▶  static site (Cloudflare Pages); server host baked in at BUILD time
3. Mobile app       ──▶  later
4. Abuse gate       ──▶  Cloudflare Turnstile + per-IP rate limits (optional, recommended)
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
| Environment variable | `VITE_PARTYKIT_HOST` = `metatictactoe.<account>.workers.dev` |
| Environment variable | `VITE_TURNSTILE_SITE_KEY` = your Turnstile **site** key (see step 4) |

`VITE_PARTYKIT_HOST` is read at **build time** (Vite inlines it), so it must be set in the Pages
environment — see [`web/.env.example`](web/.env.example). Pages checks out the whole repo, so the
`../packages/*` source the web app aliases is available during the build.

Result: `https://<project>.pages.dev` over HTTPS, so the `wss://` connection to the server matches.

Local production-style build:

```bash
cd web
VITE_PARTYKIT_HOST=metatictactoe.<account>.workers.dev npm run build
```

## 3. Mobile — later

Not deployed yet. When ready: set `mobile/app.json` → `expo.extra.partykitHost` to the deployed
host, then build with EAS (`eas build -p android --profile preview` for a shareable APK, or
`--profile production` + Play Store). EAS must see the monorepo root so `packages/*` resolve
(metro `watchFolders` + the `postinstall` symlink) — follow Expo's monorepo guide, or add `web`
and `mobile` to the root `workspaces` so EAS's built-in monorepo support handles it.

> **Heads-up if the abuse gate (step 4) is on:** the mobile client doesn't mint a Turnstile
> token yet, so it can't connect to a *gated* production server — it works against the open dev
> server only. Wiring a Turnstile webview into the RN app is a follow-up; until then keep mobile
> pointed at dev, or treat the gate as web-only.

## 4. Abuse prevention — Turnstile connection gate

The server is publicly addressable (anyone with the host can open a socket), so online play is
gated: `onBeforeConnect` rejects a connection with **401** unless it carries a short-lived,
HMAC-signed session token. The browser earns that token by passing an invisible **Cloudflare
Turnstile** challenge and exchanging it at `POST /auth`. Both the mint and the connection are
**rate-limited per IP**. There are no accounts — this is bot/abuse mitigation, not identity auth.

The gate is **off until you configure it** (so local dev and CI stay zero-setup). Turn it on once:

1. **Create a Turnstile widget** — Cloudflare dashboard → Turnstile → *Add widget*. List your web
   hostname(s), e.g. `metatictactoe-web.pages.dev` and `localhost`. Copy the **Site key** (public)
   and **Secret key** (private).

2. **Set the Worker secrets, then redeploy** (the gate becomes active once *both* are set):
   ```bash
   cd packages/party
   echo "<your-turnstile-secret-key>" | npx wrangler secret put TURNSTILE_SECRET
   openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET   # signs session tokens
   npx wrangler deploy
   ```

3. **Give the web build the site key** — Cloudflare → Pages → your project → *Settings →
   Environment variables* → add `VITE_TURNSTILE_SITE_KEY = <your-site-key>` (Production), then
   redeploy (push to `main`, or *Retry deployment*). For a local prod build, put it in
   `web/.env.production.local`.

**Verify** the live gate (should print `401`):
```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://metatictactoe.<account>.workers.dev/parties/main/TEST
```

Notes:
- **Fail-open by design:** no `AUTH_SECRET` → gate disabled; no `TURNSTILE_SECRET` → `/auth` issues
  tokens without a challenge. Set **both** for real protection. Misconfiguration locks players out
  (a real site key paired with a missing/wrong secret), which surfaces the problem rather than
  silently leaving you exposed.
- **Test keys** (Cloudflare-documented): the web defaults to the always-pass site key
  `1x00000000000000000000AA`; its matching secret is `1x0000000000000000000000000000000AA` if you
  want to exercise the full flow without a real widget.
- Tune the limits in [`packages/party/wrangler.jsonc`](packages/party/wrangler.jsonc) (`ratelimits`)
  and the session TTL / CORS origin in `packages/party/src/server.ts`.

## Wiring recap

The server host flows into the web build env (`VITE_PARTYKIT_HOST`) and, later, mobile
`app.json` `extra.partykitHost`. When the server URL changes, update it in those places.

## CI

`.github/workflows/ci.yml` runs the engine + server tests, typechecks all packages, and builds
the web app on every push / PR — a safety net before anything deploys.
