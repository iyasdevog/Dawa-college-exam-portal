/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __DEV__: boolean;
declare const __PROD__: boolean;

interface ImportMetaEnv {
  readonly VITE_DB_UNLOCK_PASSWORD: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

