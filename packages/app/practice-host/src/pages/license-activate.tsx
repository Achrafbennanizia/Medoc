import { useT, useTParams } from "@/lib/i18n";
/**
 * Master license activation gate.
 *
 * First step: choose main device (company license) vs secondary device (join main device).
 * Rendered by `LicenseAndPairingGate` when no valid local vendor license exists.
 */

import { useCallback, useEffect, useState } from "react";

import { VerbundJoinFlow } from "@/systems/practice-host/components/verbund-join-flow";
import {
    clearLicenseDeviceRole,
    readLicenseDeviceRole,
    saveLicenseDeviceRole,
    type LicenseDeviceRole,
} from "@/systems/practice-host/lib/license-device-role";
import { activateLicense, currentLicenseStatus, type LicenseStatus } from "@/systems/practice-host/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

type Step = "choose" | LicenseDeviceRole;

function DeviceRoleChooser(props: { onSelect: (role: LicenseDeviceRole) => void }) {
    const t = useT();

    return (
        <section className="license-device-role-grid" aria-labelledby="license-device-role-title">
            <h2 id="license-device-role-title" className="license-device-role-grid__title">
                {t("license.activate.device_role.title")}
            </h2>
            <p className="card-sub">{t("license.activate.device_role.intro")}</p>
            <div className="license-device-role-grid__cards">
                <button
                    type="button"
                    className="license-device-role-card"
                    onClick={() => props.onSelect("main")}
                >
                    <span className="license-device-role-card__badge">{t("license.activate.device_role.main_badge")}</span>
                    <strong>{t("license.activate.device_role.main_title")}</strong>
                    <span className="card-sub">{t("license.activate.device_role.main_body")}</span>
                </button>
                <button
                    type="button"
                    className="license-device-role-card"
                    onClick={() => props.onSelect("secondary")}
                >
                    <span className="license-device-role-card__badge license-device-role-card__badge--muted">
                        {t("license.activate.device_role.secondary_badge")}
                    </span>
                    <strong>{t("license.activate.device_role.secondary_title")}</strong>
                    <span className="card-sub">{t("license.activate.device_role.secondary_body")}</span>
                </button>
            </div>
        </section>
    );
}

function MainLicenseForm(props: { onActivated?: () => void; onBack: () => void }) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        try {
            const cur = await currentLicenseStatus();
            setStatus(cur);
        } catch (e) {
            toast(tp("license.activate.status_error", { message: errorMessage(e) }), "error");
        }
    }, [toast, tp]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const activate = async () => {
        if (!token.trim()) {
            toast(t("license.activate.token_required"), "error");
            return;
        }
        setBusy(true);
        try {
            const result = await activateLicense(token.trim());
            setStatus(result);
            if (result.valid) {
                toast(t("license.activate.success"), "success");
                setToken("");
                clearLicenseDeviceRole();
                props.onActivated?.();
            } else {
                toast(tp("license.activate.invalid", { reason: result.reason ?? "?" }), "error");
            }
        } catch (e) {
            const msg = errorMessage(e);
            toast(
                msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("verboten")
                    ? tp("license.activate.forbidden", { message: msg })
                    : tp("license.activate.error", { message: msg }),
                "error",
            );
        } finally {
            setBusy(false);
        }
    };

    if (status?.valid) {
        return (
            <section
                className="card-sub"
                style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 12,
                    marginTop: 12,
                }}
                aria-label={t("license.activate.active_aria")}
            >
                <strong>{tp("license.activate.active_label", { format: status.format ?? "?" })}</strong>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(status.licenseV2 ?? status.license, null, 2)}
                </pre>
            </section>
        );
    }

    return (
        <section
            style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                marginTop: 12,
            }}
        >
            <p className="card-sub" style={{ marginTop: 0 }}>
                {t("license.activate.device_role.main_company_hint")}
            </p>
            <p className="card-sub">
                {t("license.activate.intro")}{" "}
                <code>v2.&lt;base64&gt;.&lt;base64&gt;</code> {t("license.activate.token_hint")}
                <code>&lt;json&gt;.&lt;sig&gt;</code>.
            </p>
            <label htmlFor="license-token" className="card-sub" style={{ display: "block", marginBottom: 4 }}>
                {t("license.activate.token_label")}
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
                    {tp("license.activate.last_error", { reason: status.reason })}
                </p>
            ) : null}
            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <Button
                    type="button"
                    loading={busy}
                    disabled={busy || token.trim().length === 0}
                    onClick={() => void activate()}
                >
                    {t("license.activate.button")}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={props.onBack}>
                    {t("license.activate.device_role.back")}
                </Button>
            </div>
        </section>
    );
}

function SecondaryJoinPanel(props: { onActivated?: () => void; onBack: () => void }) {
    const t = useT();

    return (
        <section style={{ marginTop: 12 }}>
            <p className="card-sub">{t("license.activate.device_role.secondary_intro")}</p>
            <VerbundJoinFlow onComplete={props.onActivated} onBack={props.onBack} />
        </section>
    );
}

export function LicenseActivatePage(props: { onActivated?: () => void }) {
    const t = useT();
    const [step, setStep] = useState<Step>(() => readLicenseDeviceRole() ?? "choose");

    const chooseRole = (role: LicenseDeviceRole) => {
        saveLicenseDeviceRole(role);
        setStep(role);
    };

    const goBackToChoose = () => {
        clearLicenseDeviceRole();
        setStep("choose");
    };

    return (
        <main className="card-pad license-activate-page" style={{ maxWidth: 720, margin: "32px auto" }}>
            <h1 className="card-title">{t("license.activate.title")}</h1>

            {step === "choose" ? <DeviceRoleChooser onSelect={chooseRole} /> : null}
            {step === "main" ? <MainLicenseForm onActivated={props.onActivated} onBack={goBackToChoose} /> : null}
            {step === "secondary" ? (
                <SecondaryJoinPanel onActivated={props.onActivated} onBack={goBackToChoose} />
            ) : null}
        </main>
    );
}
