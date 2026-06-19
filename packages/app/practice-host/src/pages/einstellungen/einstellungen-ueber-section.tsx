import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useState } from "react";
import {
    checkForUpdates,
    currentAppVersion,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

export function EinstellungenUeberSection() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [appVersion, setAppVersion] = useState("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [aboutExpanded, setAboutExpanded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        currentAppVersion()
            .then((v) => {
                if (!cancelled) setAppVersion(v);
            })
            .catch(() => {
                if (!cancelled) setAppVersion("?");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleCheckUpdates() {
        setUpdateBusy(true);
        try {
            const info = await checkForUpdates();
            toast(
                info.update_available
                    ? tp("settings.about.update_available", { version: info.latest_version })
                    : tp("settings.about.up_to_date", { version: info.current_version }),
                info.update_available ? "info" : "success",
            );
        } catch (e) {
            toast(tp("settings.about.check_update_failed", { message: (e as Error).message ?? String(e) }), "error");
        } finally {
            setUpdateBusy(false);
        }
    }

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.about.title")}</div>
                    <div className="card-sub">{t("settings.about.subtitle")}</div>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.about.app_version")}</b>
                    <div className="card-sub">MeDoc {appVersion}</div>
                </div>
                <Button
                    variant="ghost"
                    type="button"
                    onClick={() => void handleCheckUpdates()}
                    disabled={updateBusy}
                    loading={updateBusy}
                >
                    {t("settings.about.check_updates")}
                </Button>
            </div>
            <div className="settings-row" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                <div>
                    <b>{t("settings.about.product_info")}</b>
                    <div className="card-sub">{t("settings.about.product_info_sub")}</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setAboutExpanded((v) => !v)}>
                    {aboutExpanded ? t("settings.about.less") : t("settings.about.more")}
                </Button>
            </div>
            {aboutExpanded ? (
                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                    <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>{t("app.help.about_product")}</p>
                    <p style={{ color: "var(--fg-3)", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>
                        {t("app.help.about_description")}
                    </p>
                    <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>
                        {t("app.help.about_version")} <span className="font-mono">{appVersion}</span>
                    </p>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, margin: "12px 0 0" }}>
                        {t("app.help.about_symbols")}{" "}
                        <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                            Lucide
                        </a>{" "}
                        {t("app.help.about_symbols_license")}
                    </p>
                </div>
            ) : null}
            <div className="card-pad">
                <p className="card-sub" style={{ margin: 0, lineHeight: 1.55 }}>
                    <strong>{t("settings.about.third_party")}</strong> Symbole über{" "}
                    <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                        Lucide
                    </a>{" "}
                    (ISC License). Weitere OSS-Bestandteile siehe mitgelieferte Dokumentation der Plattform (Tauri, React).
                </p>
                <p className="card-sub" style={{ margin: "12px 0 0", lineHeight: 1.55 }}>
                    Lizenz, Abo und Zahlungsmethode finden Sie unter{" "}
                    <strong>Einstellungen → Lizenz &amp; Abo</strong>.
                </p>
            </div>
        </section>
    );
}
