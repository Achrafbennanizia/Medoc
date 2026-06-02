/**
 * Master license activation gate.
 *
 * Rendered by `App.tsx` when:
 *  - the device is configured as practice_desktop or serverless_peer MASTER, AND
 *  - `current_license_status` reports no valid v2/v1 license yet.
 *
 * Calls `activate_license` which verifies + persists the supplied token.
 */

import { useCallback, useEffect, useState } from "react";

import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

type LicenseStatus = {
    valid: boolean;
    reason: string | null;
    format: string | null;
    licenseV2?: {
        customerId: string;
        edition: string;
        deviceId: string;
        activatedAt: string;
        maxUsers: number;
        modules: string[];
        editionFeatures: string[];
    } | null;
    license?: {
        customerId: string;
        edition: string;
        expiresAt: string;
        maxUsers: number;
    } | null;
};

export function LicenseActivatePage(props: { onActivated?: () => void }) {
    const toast = useToastStore((s) => s.add);
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        try {
            const cur = await practiceSystem.invoke<LicenseStatus>("current_license_status");
            setStatus(cur);
        } catch (e) {
            toast(`Lizenzstatus: ${errorMessage(e)}`, "error");
        }
    }, [toast]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const activate = async () => {
        if (!token.trim()) {
            toast("Bitte Lizenz-Token einfügen.", "error");
            return;
        }
        setBusy(true);
        try {
            const result = await practiceSystem.invoke<LicenseStatus>("activate_license", {
                token: token.trim(),
            });
            setStatus(result);
            if (result.valid) {
                toast("Lizenz aktiviert.", "success");
                setToken("");
                props.onActivated?.();
            } else {
                toast(`Lizenz ungültig: ${result.reason ?? "unbekannter Grund"}`, "error");
            }
        } catch (e) {
            const msg = errorMessage(e);
            toast(
                msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("verboten")
                    ? `Aktivierung nicht möglich: ${msg}. Bitte erneut anmelden oder Administrator kontaktieren.`
                    : `Aktivierung: ${msg}`,
                "error",
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="card-pad" style={{ maxWidth: 720, margin: "32px auto" }}>
            <h1 className="card-title">Lizenz aktivieren</h1>
            <p className="card-sub">
                Dieses Gerät ist der Master. Bitte den von uns gelieferten Lizenz-Token
                einfügen (Format <code>v2.&lt;base64&gt;.&lt;base64&gt;</code> für
                neue, gerätegebundene Lizenzen oder die ältere v1-Variante
                <code>&lt;json&gt;.&lt;sig&gt;</code>).
            </p>

            {status?.valid ? (
                <section
                    className="card-sub"
                    style={{
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 12,
                    }}
                    aria-label="Aktive Lizenz"
                >
                    <strong>Aktive Lizenz ({status.format ?? "?"})</strong>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(status.licenseV2 ?? status.license, null, 2)}
                    </pre>
                </section>
            ) : (
                <section
                    style={{
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 12,
                    }}
                >
                    <label
                        htmlFor="license-token"
                        className="card-sub"
                        style={{ display: "block", marginBottom: 4 }}
                    >
                        Lizenz-Token
                    </label>
                    <textarea
                        id="license-token"
                        rows={6}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        spellCheck={false}
                        style={{
                            width: "100%",
                            fontFamily: "monospace",
                            wordBreak: "break-all",
                            padding: 8,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                        }}
                        placeholder="v2.AAA.BBB"
                    />
                    {status?.reason ? (
                        <p className="card-sub" style={{ color: "var(--text-danger)" }}>
                            Letzter Fehler: {status.reason}
                        </p>
                    ) : null}
                    <Button
                        type="button"
                        style={{ marginTop: 12 }}
                        loading={busy}
                        disabled={busy || token.trim().length === 0}
                        onClick={() => void activate()}
                    >
                        Lizenz aktivieren
                    </Button>
                </section>
            )}
        </main>
    );
}
