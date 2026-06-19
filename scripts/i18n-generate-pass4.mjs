#!/usr/bin/env node
/** Generate scripts/i18n-translation-patches-pass4.json from i18n-gap-keys.json. */
import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pyPath = join(root, "scripts/i18n-generate-pass4-translate.py");

const result = spawnSync("python3", [pyPath], {
    encoding: "utf8",
    stdio: "inherit",
});

process.exit(result.status ?? 1);
