import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    getDbSetupStatus,
    provisionDbPassphrase,
    unlockDbPassphrase,
    type DbSetupStatus,
} from "../../controllers/db-setup.controller";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/**
 * Blocks the UI until the SQLCipher DB passphrase is provisioned or unlocked
 * (when keyring is empty but `db-key.wrap` exists).
 */
export function DbSetupGate({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<DbSetupStatus | null>(null);
    const [passphrase, setPassphrase] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
        void getDbSetupStatus()
            .then(setStatus)
            .catch(() => setStatus({ needsPassphraseSetup: false, needsUnlock: false }));
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const blocked =
        status != null && (status.needsPassphraseSetup || status.needsUnlock);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            if (status?.needsUnlock) {
                await unlockDbPassphrase(passphrase);
                window.location.reload();
                return;
            }
            await provisionDbPassphrase(passphrase, confirm);
            window.location.reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };

    if (status == null) {
        return (
            <SetupShell>
                <p className="text-body text-on-surface-variant animate-fade-in">
                    Datenbank wird vorbereitet…
                </p>
            </SetupShell>
        );
    }

    if (!blocked) {
        return <>{children}</>;
    }

    const title = status.needsUnlock
        ? "Datenbank entsperren"
        : "Datenbank-Passphrase einrichten";

    return (
        <SetupShell>
            <form
                className="w-full max-w-md space-y-4 rounded-xl border border-outline-variant bg-surface p-6 shadow-md"
                onSubmit={(e) => void onSubmit(e)}
            >
                <h1 className="text-title-lg text-on-surface">{title}</h1>
                <p className="text-body text-on-surface-variant">
                    {status.needsUnlock
                        ? "Der Schlüsselbund ist nicht verfügbar. Geben Sie Ihre Passphrase ein. Anschließend startet die Anwendung neu."
                        : "Legen Sie eine Passphrase fest (mindestens 12 Zeichen) für die lokale Datenbankverschlüsselung."}
                </p>
                <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required
                    minLength={12}
                />
                {!status.needsUnlock ? (
                    <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Passphrase bestätigen"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={12}
                    />
                ) : null}
                {error ? (
                    <p className="text-body text-error" role="alert">
                        {error}
                    </p>
                ) : null}
                <Button type="submit" disabled={busy}>
                    {status.needsUnlock ? "Entsperren" : "Einrichten"}
                </Button>
            </form>
        </SetupShell>
    );
}

function SetupShell({ children }: { children: ReactNode }) {
    return (
        <MotionlessLoadingRoot>
            {children}
        </MotionlessLoadingRoot>
    );
}

function MotionlessLoadingRoot({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-dim px-4">
            {children}
        </div>
    );
}
