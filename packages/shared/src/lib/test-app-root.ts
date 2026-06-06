import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve MeDoc repository root (contains `apps/`, `crates/`, `packages/`). */
export function findAppRoot(fromDir: string): string {
    let dir = fromDir;
    for (let i = 0; i < 10; i += 1) {
        if (
            existsSync(resolve(dir, "apps/practice-host-ui/vite.config.ts")) &&
            existsSync(resolve(dir, "packages/shared")) &&
            existsSync(resolve(dir, "crates/shared/medoc-core"))
        ) {
            return dir;
        }
        dir = resolve(dir, "..");
    }
    throw new Error(`MeDoc repository root not found from ${fromDir}`);
}

export const appRoot = findAppRoot(dirname(fileURLToPath(import.meta.url)));
