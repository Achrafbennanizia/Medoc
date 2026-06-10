/**
 * Empty join page — Geräteverbund pairing only (no practice data visible).
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    verbundDiscoverAdmins,
    verbundGetStatus,
    verbundSendJoinRequest,
    verbundSubmitSas,
    type AdminEndpoint,
    type KopplungHandle,
} from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

export function VerbundBeitretenPage() {
    const navigate = useNavigate();
    const setStatus = useVerbundStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const [admins, setAdmins] = useState<AdminEndpoint[]>([]);
    const [handle, setHandle] = useState<KopplungHandle | null>(null);
    const [digits, setDigits] = useState("");
    const [busy, setBusy] = useState(false);
    const [phase, setPhase] = useState<"scan" | "sas" | "wait">("scan");

    const scan = useCallback(async () => {
        setBusy(true);
        try {
            const found = await verbundDiscoverAdmins();
            setAdmins(found);
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    }, [toast]);

    useEffect(() => {
        void scan();
    }, [scan]);

    const join = async (admin?: AdminEndpoint) => {
        setBusy(true);
        try {
            void admin;
            const h = await verbundSendJoinRequest("MEMBER");
            setHandle(h);
            setPhase("sas");
            toast("Anfrage gesendet — 4-stelligen Code auf dem Admin-Gerät eingeben.", "info");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const confirmSas = async () => {
        if (!handle) return;
        setBusy(true);
        try {
            const result = await verbundSubmitSas(handle, digits);
            if (result.success) {
                setPhase("wait");
                toast("Provisionierung abgeschlossen.", "success");
                setStatus(await verbundGetStatus());
                navigate("/login", { replace: true });
            } else if (result.alreadyProvisioned) {
                toast("Gerät bereits provisioniert.", "error");
            } else {
                toast("SAS ungültig oder abgelehnt.", "error");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="license-gate-page">
            <div className="license-gate-card">
                <h1>Praxis-Verbund beitreten</h1>
                <p className="card-sub">Nur Kopplung — keine Praxisdaten sichtbar bis die Provisionierung abgeschlossen ist.</p>

                {phase === "scan" && (
                    <>
                        <Button type="button" disabled={busy} onClick={() => void scan()}>
                            Netzwerk scannen
                        </Button>
                        <ul>
                            {admins.map((a) => (
                                <li key={`${a.host}:${a.port}`}>
                                    {a.instanceName} — {a.host}:{a.port}{" "}
                                    <Button type="button" size="sm" disabled={busy} onClick={() => void join(a)}>
                                        Verbinden
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        <Button type="button" variant="secondary" disabled={busy} onClick={() => void join()}>
                            Manuell verbinden
                        </Button>
                    </>
                )}

                {phase === "sas" && (
                    <>
                        <label>
                            4-stelliger Code vom Admin-Bildschirm
                            <input
                                inputMode="numeric"
                                maxLength={4}
                                value={digits}
                                onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            />
                        </label>
                        <Button type="button" disabled={busy || digits.length !== 4} onClick={() => void confirmSas()}>
                            Bestätigen
                        </Button>
                    </>
                )}

                {phase === "wait" && <p role="status">Provisionierung läuft …</p>}
            </div>
        </div>
    );
}
