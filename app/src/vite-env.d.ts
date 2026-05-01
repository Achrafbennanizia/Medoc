/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Injected in `vite.config.ts` from `package.json` `version`. */
    readonly VITE_APP_VERSION: string;
}
