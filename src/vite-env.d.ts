/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DB_UNLOCK_PASSWORD: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
