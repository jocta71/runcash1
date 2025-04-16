/// <reference types="vite/client" />

// Estendendo a interface ImportMeta para incluir propriedades de ambiente do Vite
interface ImportMeta {
  readonly env: {
    [key: string]: string | boolean | undefined;
    MODE?: string;
    BASE_URL?: string;
    PROD?: boolean;
    DEV?: boolean;
    SSR?: boolean;
    VITE_WS_URL?: string;
    VITE_API_URL?: string;
    VITE_API_BASE_URL?: string;
    VITE_ASAAS_SANDBOX?: string;
  };
}
