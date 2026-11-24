/**
 * Edition of this build (Solo / Duo / Group), fixed at build time (`MEDOC_EDITION`, Vite
 * `define`) and matching the Rust feature `edition-*`. See docs/architecture/editions-plan.md §3.
 *
 * Read capabilities from `CAPS`. To leave code out of an edition's bundle, gate on the bare
 * constant instead (`if (__CAP_NET__) { await import("…") }`): only literals are tree-shaken.
 */
import { CAPABILITY_IDS, EDITIONS, type Caps, type EditionId, type EditionLimits, type EditionSpec } from "./edition.generated";
import { DEVICE_FLAVOR } from "./device-flavor";

export type { Capability, Caps, EditionId, EditionLimits, EditionSpec } from "./edition.generated";
export { CAPABILITY_IDS, EDITIONS } from "./edition.generated";

export const EDITION: EditionSpec = EDITIONS[__MEDOC_EDITION__];
export const CAPS: Caps = EDITION.caps;

/** What the Rust `edition_info` command returns. */
export type EditionInfo = {
    edition: EditionId;
    flavor: "main" | "replica";
    caps: Caps;
    limits: EditionLimits;
    version: string;
};

/**
 * Differences between this UI build and the native core it runs on, as readable lines; empty when
 * they match. A UI of one edition must never run on a core of another.
 */
export function editionMismatch(
    core: EditionInfo,
    ui: { edition: EditionSpec; flavor: string } = { edition: EDITION, flavor: DEVICE_FLAVOR },
): string[] {
    const out: string[] = [];
    if (core.edition !== ui.edition.id) out.push(`edition: core ${core.edition}, ui ${ui.edition.id}`);
    if (core.flavor !== ui.flavor) out.push(`flavor: core ${core.flavor}, ui ${ui.flavor}`);
    for (const cap of CAPABILITY_IDS) {
        if (Boolean(core.caps?.[cap]) !== ui.edition.caps[cap]) {
            out.push(`capability ${cap}: core ${Boolean(core.caps?.[cap])}, ui ${ui.edition.caps[cap]}`);
        }
    }
    return out;
}
