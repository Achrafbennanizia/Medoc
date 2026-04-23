import { tauriInvoke } from "@/services/tauri.service";

export function generateVvt() {
    return tauriInvoke<unknown>("generate_vvt");
}

export function generateDsfa() {
    return tauriInvoke<unknown>("generate_dsfa");
}

export function enforceLogRetention() {
    return tauriInvoke<unknown>("enforce_log_retention");
}
