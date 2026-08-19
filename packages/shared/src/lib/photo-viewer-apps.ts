import { listDetectedPhotoViewerApps as fetchPhotoViewerApps, type DetectedPhotoViewerApp } from "@/systems/practice-host/controllers/system.controller";

export type { DetectedPhotoViewerApp };

/** Explicitly OS default only (`open` / `xdg-open` without app). */
export const OPEN_IMAGE_SYSTEM_ONLY = "__SYSTEM__";

let cached: DetectedPhotoViewerApp[] | null = null;

export async function loadDetectedPhotoViewerApps(force = false): Promise<DetectedPhotoViewerApp[]> {
    if (!force && cached) return cached;
    const apps = await fetchPhotoViewerApps();
    cached = apps;
    return apps;
}

export function photoViewerAppOptionsForSelect(apps: DetectedPhotoViewerApp[], t: (key: string) => string) {
    const base: { value: string; label: string }[] = [
        { value: "", label: t("settings.photo_viewer.recommended_first") },
        { value: OPEN_IMAGE_SYSTEM_ONLY, label: t("settings.photo_viewer.system_default") },
    ];
    const rest = apps.map((a) => ({
        value: a.path,
        label: `${a.display_name}`,
    }));
    return [...base, ...rest];
}

/**
 * Resolution for `open_chart_attachment_externally`: empty = first found app;
 * {@link OPEN_IMAGE_SYSTEM_ONLY} = OS-Default; sonst konkreter Path.
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
