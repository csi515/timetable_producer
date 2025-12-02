/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_ADSENSE_PUB_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
