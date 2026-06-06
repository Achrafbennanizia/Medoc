import { invoke } from "@tauri-apps/api/core";

export type DbSetupStatus = {
    needsPassphraseSetup: boolean;
    needsUnlock: boolean;
};

export async function getDbSetupStatus(): Promise<DbSetupStatus> {
    return invoke<DbSetupStatus>("get_db_setup_status");
}

export async function provisionDbPassphrase(passphrase: string, confirm: string): Promise<void> {
    await invoke("provision_db_passphrase", { passphrase, confirm });
}

export async function unlockDbPassphrase(passphrase: string): Promise<void> {
    await invoke("unlock_db_passphrase", { passphrase });
}
