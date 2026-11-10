// SPDX-License-Identifier: MIT

/**
 * Online-mode configuration: the PartyKit host and the Turnstile settings. Room codes are
 * shared with the web app via `@mtt/protocol`.
 */
import Constants from 'expo-constants';

/**
 * Where the PartyKit server lives. Configured in `app.json` under `expo.extra.partykitHost`.
 *
 * Host notes:
 *   - iOS simulator / web: `127.0.0.1:1999` reaches a server on the dev machine.
 *   - Android emulator: use `10.0.2.2:1999` (the emulator's alias for the host).
 *   - Physical device via Expo Go: use the dev machine's LAN IP, e.g. `192.168.0.105:1999`.
 */
export const PARTYKIT_HOST: string =
  (Constants.expoConfig?.extra?.partykitHost as string | undefined) ?? '127.0.0.1:1999';

/**
 * Cloudflare Turnstile **site** key (public — safe to ship) for the online abuse gate.
 * Configured in `app.json` under `expo.extra.turnstileSiteKey`. Defaults to Cloudflare's
 * documented "always passes" test key so local dev works untouched; set your real key for
 * production. Mirrors the web app's `VITE_TURNSTILE_SITE_KEY`.
 */
export const TURNSTILE_SITE_KEY: string =
  (Constants.expoConfig?.extra?.turnstileSiteKey as string | undefined) ??
  '1x00000000000000000000AA';

/**
 * Origin used as the WebView `baseUrl` when rendering the Turnstile challenge. A *real*
 * Turnstile site key only renders on domains allow-listed in the Cloudflare dashboard, so the
 * WebView must report an allowed origin. Set `expo.extra.turnstilePageOrigin` to the web app's
 * origin (e.g. `https://mttt.example.com`). Empty by default — fine for the always-pass test
 * key in dev, which renders on any origin.
 */
export const TURNSTILE_PAGE_ORIGIN: string =
  (Constants.expoConfig?.extra?.turnstilePageOrigin as string | undefined) ?? '';
