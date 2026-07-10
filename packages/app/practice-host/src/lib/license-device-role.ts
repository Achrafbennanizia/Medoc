export type LicenseDeviceRole = "main" | "secondary";

const STORAGE_KEY = "medoc.license.device_role.v1";

export function readLicenseDeviceRole(): LicenseDeviceRole | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw === "main" || raw === "secondary" ? raw : null;
    } catch {
        return null;
    }
}

export function saveLicenseDeviceRole(role: LicenseDeviceRole): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, role);
    } catch {
        /* ignore */
    }
}

export function clearLicenseDeviceRole(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
