# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately via either:

- **GitHub private vulnerability reporting** — open the repository's **Security → Report a
  vulnerability** tab ([GitHub docs](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)), or
- **Email** — **hello@isstiaung.me**.

Please include enough detail to reproduce the issue (affected component — engine, web, mobile, or the
party server — steps, and impact). We'll acknowledge your report as soon as we can and keep you
updated on the fix. Please give us a reasonable chance to address the issue before any public
disclosure.

## Scope

This is a hobby/open-source project with no formal bug-bounty program, but reports are genuinely
appreciated. Areas most worth a look:

- **`@mtt/party`** (the authoritative Cloudflare Workers server) — turn/legality enforcement, seat
  assignment, the HMAC session-token logic (`packages/party/src/auth.ts`), and the connection gate.
- **The online abuse gate** — Cloudflare Turnstile challenge + short-lived session tokens + per-IP
  rate limits.

## How secrets are handled (important for self-hosters)

- The server's auth gate is **fail-open**: it is disabled until both `TURNSTILE_SECRET` and
  `AUTH_SECRET` are set as Cloudflare Worker secrets. Local development and CI therefore need **no
  secrets**.
- **Never** commit secrets. Set them with `wrangler secret put <NAME>` — **not** in `.env` files or
  source. The only public, ship-safe value is the Turnstile **site** key (client-side by design).
- See [`DEPLOY.md`](DEPLOY.md) for the full production secret setup.

If you fork and self-host, generate your **own** Cloudflare Turnstile widget and `AUTH_SECRET`; do not
reuse any values from this repository's documentation.
