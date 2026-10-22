# Deploying MetaTicTacToe

**Two Cloudflare Workers, both auto-deployed when you merge to `deploy-app`** — via Cloudflare's
native **Workers Builds** (git-triggered CI/CD). No GitHub Actions, no manual `wrangler deploy`.
Everything fits free hobby tiers (the only optional cost is the Play Store's one-time $25, mobile only).

| Worker | What it is | Host | Config |
| --- | --- | --- | --- |
| `metatictactoe` | **Game server** — `POST /auth` + `wss /parties/*` (partyserver + Durable Objects) | `party.mttt.isstiaung.me` | `packages/party/wrangler.jsonc` |
| `metatictactoe-web` | **Web app** — the Vite SPA (assets-only worker) | `mttt.isstiaung.me` | `web/wrangler.jsonc` |

Players visit **`mttt.isstiaung.me`** (web worker); the app connects to **`party.mttt.isstiaung.me`**
(game server) for online play. Both also stay reachable on their `*.workers.dev` hosts.

## Auto-deploy: merge `main` → `deploy-app`

Each worker has its **own** Workers Builds connection to this repo, both watching the **`deploy-app`**
branch. Push (or merge) to `deploy-app` and both workers rebuild and deploy. That's the whole release
flow once the one-time setup below is done.

### One-time setup — per worker (Cloudflare dashboard)

Dashboard → **Workers & Pages** → *(the worker)* → **Settings → Build** → connect the GitHub repo
`isstiaung/MetaTicTacToe`, then set the fields below.

> **The web worker doesn't exist yet.** `metatictactoe-web` is currently a *Pages* project (Direct
> Upload — Cloudflare can't attach a git connection to those, which is the "No Git connection" you
> see). Delete that Pages project first (it frees the name **and** the `mttt.isstiaung.me` domain),
> then create the web **Worker** via **Create → Workers → Import a repository** — that flow connects
> git + builds in one step. The game-server worker `metatictactoe` already exists, so just connect git
> in its **Settings → Build**.

**1. Game server — `metatictactoe`**

| Field | Value |
| --- | --- |
| Git branch | `deploy-app` |
| Root directory | `/` |
| Build command | `npm ci && npm test && npm run typecheck` |
| Deploy command | `npx wrangler deploy --config packages/party/wrangler.jsonc` |

No build variables. Its runtime **secrets** are set separately (see *Abuse gate* below) and persist
across deploys — Workers Builds never touches them.

**2. Web app — `metatictactoe-web`**

| Field | Value |
| --- | --- |
| Git branch | `deploy-app` |
| Root directory | `/` |
| Build command | `npm ci && npm test && npm run typecheck && npm ci --prefix web && npm run build --prefix web` |
| Deploy command | `npx wrangler deploy --config web/wrangler.jsonc` |

Build variables (**public** — Vite inlines them into the bundle at build time; *not* secrets):

| Variable | Value |
| --- | --- |
| `VITE_PARTYKIT_HOST` | `party.mttt.isstiaung.me` |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAAAADri3jNemOcHmzhE` (Turnstile **site** key) |

> **Optional:** in each worker's Build settings, set **build watch paths** so the game server only
> rebuilds on `packages/**` changes and the web worker only on `web/**`. By default both deploy on
> every push to `deploy-app`, which is fine.

**Test gate.** Both build commands run `npm test && npm run typecheck` (engine + server tests and all
package typechecks) *before* building/deploying; the web worker additionally gates on the web build
(`tsc -b && vite build`). A failing test or type error fails the build, so the deploy is skipped and
the broken revision never reaches production. This keeps the gate inside Cloudflare (no GitHub
Actions) — note it runs at **deploy time**, so it blocks the deploy, not the merge. (If you also want
**pre-merge** checks on PRs, that would be a small tests-only GitHub Action.)

### Custom domains (one-time)

`custom_domain: true` in each `wrangler.jsonc` makes `wrangler deploy` provision the domain on the
`isstiaung.me` zone automatically — but a domain can attach to only **one** resource. `mttt.isstiaung.me`
is currently on the **`metatictactoe-web` Pages project**, so free it first:

1. Delete the `metatictactoe-web` **Pages** project (dashboard → its *Settings → Delete*, or
   `npx wrangler pages project delete metatictactoe-web`). This frees the name and `mttt.isstiaung.me`.
2. The first git-deploy of each worker then claims its domain: the new `metatictactoe-web` **Worker**
   → `mttt.isstiaung.me`, and `metatictactoe` → `party.mttt.isstiaung.me`. (Or add them by hand under
   each worker's *Settings → Domains & Routes*.)

> Brief gap: `mttt.isstiaung.me` is down between deleting the Pages project and the web worker's
> first successful build. Do the web worker setup right after the delete to keep it short.

## Manual deploy (fallback)

From a checkout, with `npx wrangler login` done once:

```bash
# Game server
npx wrangler deploy --config packages/party/wrangler.jsonc

# Web app — build first (Vite reads web/.env.production.local for the two VITE_ vars), then deploy
npm run build --prefix web
npx wrangler deploy --config web/wrangler.jsonc
```

For local prod builds the two `VITE_` values live in `web/.env.production.local` (gitignored); see
[`web/.env.example`](web/.env.example).

## Abuse gate — Turnstile connection gate (game server)

The game-server worker is publicly addressable (anyone with the host can open a socket), so online
play is gated: `onBeforeConnect` rejects a connection with **401** unless it carries a short-lived,
HMAC-signed session token. The browser earns that token by passing an invisible **Cloudflare
Turnstile** challenge and exchanging it at `POST /auth`. Both the mint and the connection are
**rate-limited per IP**. There are no accounts — this is bot/abuse mitigation, not identity auth.

The gate is **off until you configure it** (so local dev and CI stay zero-setup). Turn it on once:

1. **Create a Turnstile widget** — Cloudflare dashboard → Turnstile → *Add widget*. List your web
   hostname(s): **`mttt.isstiaung.me`** and `localhost`. Copy the **Site key** (public — it's the
   `VITE_TURNSTILE_SITE_KEY` build var above) and the **Secret key** (private — used below).

2. **Set the game-server worker's secrets** (the gate becomes active once *both* are set; they
   persist across Workers Builds deploys):
   ```bash
   cd packages/party
   echo "<your-turnstile-secret-key>" | npx wrangler secret put TURNSTILE_SECRET
   openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET   # signs session tokens
   ```
   (No redeploy needed for secrets to take effect, but a deploy is harmless.)

3. **Web build already has the site key** via the `VITE_TURNSTILE_SITE_KEY` build variable (above)
   and `web/.env.production.local` for local builds.

**Verify** the live gate (should print `401`):
```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' \
  https://party.mttt.isstiaung.me/parties/main/TEST
```

Notes:
- **Off until configured:** no `AUTH_SECRET` → gate disabled (dev). `AUTH_SECRET` without
  `TURNSTILE_SECRET` → `/auth` **fails closed** (503 `turnstile_not_configured`) instead of issuing
  unchallenged tokens. Set **both** for real protection.
- **Test keys** (Cloudflare-documented): the web defaults to the always-pass site key
  `1x00000000000000000000AA`; its matching secret is `1x0000000000000000000000000000000AA`.
- Tune the limits in [`packages/party/wrangler.jsonc`](packages/party/wrangler.jsonc) (`ratelimits`)
  and the session TTL / CORS origin (`WEB_ORIGIN`) in `packages/party/src/server.ts`. `WEB_ORIGIN`
  is `"*"` (fine — `/auth` requires a Turnstile solve); tighten to `https://mttt.isstiaung.me` if you like.

## Mobile — later

Not deployed yet. When ready: set `mobile/app.json` → `expo.extra.partykitHost` to
`party.mttt.isstiaung.me`, then build with EAS (`eas build -p android --profile preview` for a
shareable APK, or `--profile production` + Play Store). EAS must see the monorepo root so `packages/*`
resolve (metro `watchFolders` + the `postinstall` symlink) — follow Expo's monorepo guide.

> **Heads-up:** the mobile client solves Turnstile in a WebView (`TurnstileModal`). A *real* site
> key only renders on its allow-listed hostnames, so also set `expo.extra.turnstileSiteKey` and
> `expo.extra.turnstilePageOrigin` (the web app's origin, e.g. `https://mttt.isstiaung.me`) in
> `mobile/app.json` before pointing it at the gated production server.

## Local dev

```bash
npm run dev -w @mtt/party   # game server on 127.0.0.1:1999 (clients' default host)
cd web && npm run dev       # Vite dev server (defaults VITE_PARTYKIT_HOST to 127.0.0.1:1999)
npm test                    # engine + party tests
npm run typecheck           # all shared packages
```
