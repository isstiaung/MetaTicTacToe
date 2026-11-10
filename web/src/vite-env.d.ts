// SPDX-License-Identifier: MIT

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Host of the PartyKit server, e.g. "127.0.0.1:1999" or a deployed host. */
  readonly VITE_PARTYKIT_HOST?: string;
  /** Cloudflare Turnstile site key (public). Defaults to a test key for local dev. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
