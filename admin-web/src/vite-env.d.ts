/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base do backend Express (sem barra final), ex.: http://localhost:3000 */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
