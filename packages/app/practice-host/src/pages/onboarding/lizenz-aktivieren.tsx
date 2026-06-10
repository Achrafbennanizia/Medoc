import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { verbundActivateLicense } from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Onboarding path: activate license and become cluster owner (first ADMIN seat). */
export function LizenzAktivierenOnboardingPage() {
    const navigate = useNavigate();
    const setStatus = useVerbundStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);

    const activate = async () => {
        if (!token.trim()) {
            toast("Bitte Lizenzschlüssel einfügen.", "error");
            return;
        }
        setBusy(true);
        try {
            const status = await verbundActivateLicense(token.trim());
            setStatus(status);
            if (status.licensed) {
                toast("Lizenz und Verbund aktiviert.", "success");
                navigate("/login", { replace: true });
            } else {
                toast("Lizenz ungültig.", "error");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="license-gate-card" style={{ maxWidth: 720, margin: "32px auto" }}>
            <h1>Lizenz aktivieren</h1>
            <p className="card-sub">Dieses Gerät wird Eigentümer des Praxis-Verbunds (erster ADMIN-Sitz).</p>
            <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={4}
                style={{ width: "100%" }}
                placeholder="Lizenzschlüssel"
            />
            <Button type="button" disabled={busy} onClick={() => void activate()}>
                Aktivieren
            </Button>
        </main>
    );
}
