/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PUSHER_KEY?: string;
  readonly VITE_PUSHER_CLUSTER?: string;
  readonly VITE_PUSHER_HOST?: string;
  readonly VITE_PUSHER_PORT?: string;
  readonly VITE_PUSHER_USE_TLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
