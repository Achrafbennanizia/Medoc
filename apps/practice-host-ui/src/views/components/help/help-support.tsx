/**
 * Help → Support: the admin describes the problem, MeDoc saves a sealed support file to Downloads and opens
 * the practice's mail app (editions plan §11.3). Nothing is sent by MeDoc itself; no mail password is stored.
 */
import { useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { createSupportBundle, type SupportBundleResult } from "@/systems/practice-host/controllers/system.controller";
import { Button } from "@/views/components/ui/button";
import { Input, Textarea } from "@/views/components/ui/input";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { HelpHealth } from "./help-health";

export function HelpSupport({ initialRef }: { initialRef?: string }) {
    const t = useT();
    const tp = useTParams();
    const [description, setDescription] = useState("");
    const [errorRef, setErrorRef] = useState(initialRef ?? "");
    const [includeLogs, setIncludeLogs] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SupportBundleResult | null>(null);

    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            setResult(
                await createSupportBundle({
                    description,
                    includeLogs,
                    errorRef: errorRef.trim() || undefined,
                    bodyIntro: t("help.support.mail_body"),
                }),
            );
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="help-stack help-support">
            <p className="help-intro">{t("help.support.intro")}</p>
            <Textarea
                label={t("help.support.description")}
                placeholder={t("help.support.description_ph")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={10_000}
            />
            <div className="help-support__row">
                <Input
                    label={t("help.support.error_ref")}
                    placeholder="MD-APP-003"
                    value={errorRef}
                    onChange={(e) => setErrorRef(e.target.value)}
                    maxLength={24}
                />
                <label className="help-support__switch">
                    <SettingsSwitch ariaLabel={t("help.support.include_logs")} checked={includeLogs} onChange={setIncludeLogs} />
                    <span>{t("help.support.include_logs")}</span>
                </label>
            </div>
            <p className="help-support__note">{t("help.support.privacy")}</p>
            <div className="help-support__actions">
                <Button type="button" loading={busy} disabled={description.trim().length < 3} onClick={() => void create()}>
                    {t("help.support.create")}
                </Button>
            </div>
            {error ? (
                <p className="help-support__error" role="alert">
                    {error}
                </p>
            ) : null}
            {result ? (
                <div className="help-support__result" role="status">
                    <div className="help-support__result-title">{t("help.support.saved_title")}</div>
                    <div className="help-support__result-path">{tp("help.support.saved_in", { path: result.path })}</div>
                    {result.devKey ? <div className="help-support__note">{t("help.support.dev_key")}</div> : null}
                    <div className="help-support__actions">
                        <Button
                            type="button"
                            onClick={() => {
                                window.location.href = result.mailto;
                            }}
                        >
                            {t("help.support.open_mail")}
                        </Button>
                    </div>
                </div>
            ) : null}
            <HelpHealth />
        </div>
    );
}
