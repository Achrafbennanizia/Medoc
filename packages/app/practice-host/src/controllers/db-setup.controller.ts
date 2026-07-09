import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type DbSetupStatus = {
    needsPassphraseSetup: boolean;
    needsUnlock: boolean;
};

export async function getDbSetupStatus(): Promise<DbSetupStatus> {
    return practiceSystem.invoke<DbSetupStatus>("get_db_setup_status");
}

export async function provisionDbPassphrase(passphrase: string, confirm: string): Promise<void> {
    await practiceSystem.invoke("provision_db_passphrase", { passphrase, confirm });
}

export async function unlockDbPassphrase(passphrase: string): Promise<void> {
    await practiceSystem.invoke("unlock_db_passphrase", { passphrase });
}
