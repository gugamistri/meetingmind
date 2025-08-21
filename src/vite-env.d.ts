/// <reference types="vite/client" />

// Vite environment variables type definitions
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Add more environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
