import {
    ONBOARDING_LICENSE_PENDING_KEY,
    ONBOARDING_LICENSE_TOKEN_KEY,
} from "../controllers/verbund.controller";
import { clearLicenseDeviceRole } from "./license-device-role";

/** Drop browser-side license/onboarding hints before a backend wipe + restart. */
export function clearDesktopLicenseClientState(): void {
    clearLicenseDeviceRole();
    try {
        sessionStorage.removeItem(ONBOARDING_LICENSE_PENDING_KEY);
        sessionStorage.removeItem(ONBOARDING_LICENSE_TOKEN_KEY);
    } catch {
        /* ignore */
    }
}
