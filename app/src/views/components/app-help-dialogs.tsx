import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

type AboutProps = {
    open: boolean;
    onClose: () => void;
    appVersion?: string;
};

export function AboutAppDialog({ open, onClose, appVersion = "0.1.0" }: AboutProps) {
    return (
        <Dialog open={open} onClose={onClose} title="Über MeDoc">
            <div style={{ textAlign: "left" }}>
                <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>MeDoc Praxisverwaltung</p>
                <p style={{ color: "var(--fg-3)", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>
                    Desktop-Anwendung für Termine, Patientenakten, Finanzen und Compliance — mit klarem Fokus auf
                    Datenschutz und Nachvollziehbarkeit.
                </p>
                <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>
                    Version <span className="font-mono">{appVersion}</span>
                </p>
            </div>
        </Dialog>
    );
}

type RoleSwitchProps = {
    open: boolean;
    onClose: () => void;
    onConfirmLogout: () => void;
};

/** Honest UX: roles are bound at login; switching requires re-authentication. */
export function RoleSwitchDialog({ open, onClose, onConfirmLogout }: RoleSwitchProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Rolle wechseln"
            footer={
                <>
                    <Button variant="ghost" style={{ flex: 1 }} onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button style={{ flex: 1 }} onClick={onConfirmLogout}>
                        Abmelden
                    </Button>
                </>
            }
        >
            <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                Ihre Berechtigungen sind an die Anmeldung gebunden. Um mit einer anderen Rolle zu arbeiten, melden Sie sich
                ab und erneut mit dem entsprechenden Konto an.
            </p>
        </Dialog>
    );
}
