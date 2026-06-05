/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly CALINO_GITHUB_REPO?: string
  readonly CALINO_CONTACT_EMAIL?: string
  readonly CALINO_ENABLE_SW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
