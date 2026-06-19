import { useT } from "@/lib/i18n";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    ONBOARDING_LICENSE_PENDING_KEY,
    verbundImportActivation,
    verbundPickActivationManifest,
} from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { OnboardingShell } from "@/views/components/onboarding-shell";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Onboarding: import offline activation.json from medoc-keygen (admin owner device). */
export function AktivierungImportOnboardingPage() {
    const t = useT();
    const navigate = useNavigate();
    const setStatus = useVerbundStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const [manifestPath, setManifestPath] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [passphrase2, setPassphrase2] = useState("");
    const [fingerprint, setFingerprint] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [importDone, setImportDone] = useState(false);

    const browseManifest = async () => {
        try {
            const picked = await verbundPickActivationManifest();
            if (picked) setManifestPath(picked);
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    };

    const finishImport = (fp: string, removed: boolean, requiresReload: boolean) => {
        setFingerprint(fp);
        setImportDone(true);
        toast(
            removed
                ? t("onboarding.activation.import_success_removed")
                : t("onboarding.activation.import_success_manual"),
            "success",
        );
        if (requiresReload) {
            sessionStorage.setItem(ONBOARDING_LICENSE_PENDING_KEY, "1");
            window.location.reload();
            return;
        }
        navigate("/onboarding/lizenz", { replace: true });
    };

    const importManifest = async () => {
        if (!manifestPath.trim()) {
            toast(t("onboarding.activation.path_required"), "error");
            return;
        }
        if (!passphrase || passphrase !== passphrase2) {
            toast(t("onboarding.activation.passphrase_mismatch"), "error");
            return;
        }
        setBusy(true);
        try {
            const result = await verbundImportActivation(manifestPath.trim(), passphrase);
            setStatus(result.status);
            const fp = result.deviceFingerprint ?? result.status.localFingerprint;
            if (!fp) {
                toast(t("onboarding.activation.import_failed"), "error");
                return;
            }
            finishImport(fp, result.manifestRemoved, result.requiresAppReload);
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <OnboardingShell>
            <h1>{t("onboarding.activation.title")}</h1>
            <p className="card-sub">{t("onboarding.activation.intro")}</p>
            <label className="onboarding-field">
                {t("onboarding.activation.path_label")}
                <div className="onboarding-path-row">
                    <input
                        type="text"
                        value={manifestPath}
                        onChange={(e) => setManifestPath(e.target.value)}
                        placeholder={t("onboarding.activation.path_placeholder")}
                        disabled={importDone}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={busy || importDone}
                        onClick={() => void browseManifest()}
                    >
                        {t("onboarding.activation.browse_btn")}
                    </Button>
                </div>
            </label>
            <label className="onboarding-field">
                {t("onboarding.activation.manifest_passphrase")}
                <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoComplete="new-password"
                    disabled={importDone}
                />
            </label>
            <label className="onboarding-field">
                {t("onboarding.activation.manifest_passphrase_repeat")}
                <input
                    type="password"
                    value={passphrase2}
                    onChange={(e) => setPassphrase2(e.target.value)}
                    autoComplete="new-password"
                    disabled={importDone}
                />
            </label>
            <div className="onboarding-actions onboarding-actions--row">
                <Button
                    type="button"
                    disabled={busy || importDone}
                    onClick={() => void importManifest()}
                >
                    {t("onboarding.activation.import_btn")}
                </Button>
                {fingerprint && !importDone ? (
                    <Button type="button" variant="primary" onClick={() => navigate("/onboarding/lizenz")}>
                        {t("onboarding.activation.next_license")}
                    </Button>
                ) : null}
                <Link to="/onboarding" className="btn btn-subtle">
                    {t("onboarding.activation.back")}
                </Link>
            </div>
            {fingerprint ? (
                <p className="card-sub" style={{ marginTop: 16 }}>
                    {t("onboarding.activation.fingerprint")} <code>{fingerprint}</code>
                </p>
            ) : null}
        </OnboardingShell>
    );
}
