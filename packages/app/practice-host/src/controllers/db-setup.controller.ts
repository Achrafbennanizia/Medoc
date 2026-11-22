import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

export type DbSetupStatus = {
    needsPassphraseSetup: boolean;
    needsUnlock: boolean;
    /** Safe-bridge checklist lines when Bridge B setup is required. */
    recoveryChecklist?: string[];
};

export async function getDbSetupStatus(): Promise<DbSetupStatus> {
    return practiceSystem.invoke<DbSetupStatus>("get_db_setup_status");
}

export async function provisionDbPassphrase(passphrase: string, confirm: string): Promise<void> {
    await practiceSystem.invoke<void>("provision_db_passphrase", { passphrase, confirm });
}

export async function unlockDbPassphrase(passphrase: string): Promise<void> {
    await practiceSystem.invoke<void>("unlock_db_passphrase", { passphrase });
}
