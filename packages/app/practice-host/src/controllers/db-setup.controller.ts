import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";

export type DbSetupStatus = {
    needsPassphraseSetup: boolean;
    needsUnlock: boolean;
};

export async function getDbSetupStatus(): Promise<DbSetupStatus> {
    return tauriInvoke<DbSetupStatus>("get_db_setup_status");
}

export async function provisionDbPassphrase(passphrase: string, confirm: string): Promise<void> {
    await tauriInvoke("provision_db_passphrase", { passphrase, confirm });
}

export async function unlockDbPassphrase(passphrase: string): Promise<void> {
    await tauriInvoke("unlock_db_passphrase", { passphrase });
}
