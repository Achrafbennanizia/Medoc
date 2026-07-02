import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useState } from "react";
import {
    checkForUpdates,
    currentAppVersion,
    installAvailableUpdate,
    type UpdateInfo,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

export function EinstellungenUeberSection() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [appVersion, setAppVersion] = useState("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [installBusy, setInstallBusy] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
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
            setUpdateInfo(info);
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

    async function handleInstallUpdate() {
        setInstallBusy(true);
        try {
            await installAvailableUpdate();
            toast(t("settings.about.install_update_success"), "success");
        } catch (e) {
            toast(tp("settings.about.install_update_failed", { message: (e as Error).message ?? String(e) }), "error");
        } finally {
            setInstallBusy(false);
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
                    {updateInfo?.update_available ? (
                        <div className="card-sub" style={{ marginTop: 6 }}>
                            {tp("settings.about.update_available", { version: updateInfo.latest_version })}
                        </div>
                    ) : null}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Button
                        variant="ghost"
                        type="button"
                        onClick={() => void handleCheckUpdates()}
                        disabled={updateBusy || installBusy}
                        loading={updateBusy}
                    >
                        {t("settings.about.check_updates")}
                    </Button>
                    {updateInfo?.update_available ? (
                        <Button
                            type="button"
                            onClick={() => void handleInstallUpdate()}
                            disabled={installBusy || updateBusy}
                            loading={installBusy}
                        >
                            {t("settings.about.install_update")}
                        </Button>
                    ) : null}
                </div>
            </div>
            {updateInfo?.update_available && updateInfo.release_notes ? (
                <p className="card-sub" style={{ margin: "0 0 12px", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                    {updateInfo.release_notes}
                </p>
            ) : null}
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
                    <strong>{t("settings.about.third_party")}</strong> {t("settings.about.third_party_lucide")}{" "}
                    <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                        Lucide
                    </a>{" "}
                    {t("settings.about.third_party_oss")}
                </p>
                <p className="card-sub" style={{ margin: "12px 0 0", lineHeight: 1.55 }}>
                    {t("settings.about.license_pointer")}{" "}
                    <strong>{t("settings.about.license_nav")}</strong>.
                </p>
            </div>
        </section>
    );
}
