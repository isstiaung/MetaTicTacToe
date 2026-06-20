/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Host of the PartyKit server, e.g. "127.0.0.1:1999" or a deployed host. */
  readonly VITE_PARTYKIT_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
