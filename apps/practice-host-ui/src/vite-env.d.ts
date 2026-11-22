/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Injected in `vite.config.ts` from `package.json` `version`. */
    readonly VITE_APP_VERSION: string;
    /** Build flavor: "replica" for the replica app, otherwise the main app (device-flavor.ts). */
    readonly VITE_MEDOC_FLAVOR?: string;
}
