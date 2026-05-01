import { listDetectedPhotoViewerApps as fetchPhotoViewerApps, type DetectedPhotoViewerApp } from "@/controllers/system.controller";

export type { DetectedPhotoViewerApp };

/** Explizit nur Betriebssystem-Standard (`open` / `xdg-open` ohne App). */
export const OPEN_IMAGE_SYSTEM_ONLY = "__SYSTEM__";

let cached: DetectedPhotoViewerApp[] | null = null;

export async function loadDetectedPhotoViewerApps(force = false): Promise<DetectedPhotoViewerApp[]> {
    if (!force && cached) return cached;
    const apps = await fetchPhotoViewerApps();
    cached = apps;
    return apps;
}

export function photoViewerAppOptionsForSelect(apps: DetectedPhotoViewerApp[]) {
    const base: { value: string; label: string }[] = [
        { value: "", label: "Empfohlen: erste gefundene App (Liste)" },
        { value: OPEN_IMAGE_SYSTEM_ONLY, label: "Nur Systemstandard (wie Doppelklick)" },
    ];
    const rest = apps.map((a) => ({
        value: a.path,
        label: `${a.display_name}`,
    }));
    return [...base, ...rest];
}

/**
 * Auflösung für `open_akte_anlage_externally`: leer = erste gefundene App;
 * {@link OPEN_IMAGE_SYSTEM_ONLY} = OS-Default; sonst konkreter Pfad.
 */
export async function resolveOpenImageWithAppPath(
    stored: string | undefined | null,
): Promise<string | undefined> {
    const t = (stored ?? "").trim();
    if (t === OPEN_IMAGE_SYSTEM_ONLY) return undefined;
    if (t.length > 0) return t;
    const apps = await loadDetectedPhotoViewerApps();
    const first = apps[0]?.path?.trim();
    return first && first.length > 0 ? first : undefined;
}
