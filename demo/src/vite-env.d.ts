/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_SERVER: string
  readonly VITE_INITIAL_TASK: string
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}