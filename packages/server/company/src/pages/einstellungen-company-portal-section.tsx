import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    companyPortalBillingPortalUrl,
    companyPortalPing,
    getCompanyPortalConfig,
    setCompanyPortalConfig,
    type CompanyPortalConfig,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { useT } from "@/lib/i18n";
import { errorMessage, formatTpl } from "@/lib/utils";

function Mono({ children }: { children: ReactNode }) {
    return <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{children}</code>;
}

const EMPTY: CompanyPortalConfig = { base_url: "", practice_slug: "", api_key: "" };

export function EinstellungenCompanyPortalSection({ embedded = false }: { embedded?: boolean } = {}) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const [cfg, setCfg] = useState<CompanyPortalConfig>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [pingBusy, setPingBusy] = useState(false);
    const [billingBusy, setBillingBusy] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [demoMode, setDemoMode] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const c = await getCompanyPortalConfig();
            setCfg({
                base_url: (c.base_url ?? "").trim(),
                practice_slug: (c.practice_slug ?? "").trim(),
                api_key: (c.api_key ?? "").trim(),
            });
        } catch (e) {
            toast(formatTpl(t("page.company.portal.toast.load_err"), { error: errorMessage(e) }), "error");
        }
    }, [toast, t]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const saveCfg = async () => {
        setBusy(true);
        try {
            await setCompanyPortalConfig(cfg);
            toast(t("page.company.portal.toast.saved"), "success");
            await refresh();
        } catch (e) {
            toast(formatTpl(t("page.company.portal.toast.save_err"), { error: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const ping = async () => {
        setPingBusy(true);
        try {
            const j = await companyPortalPing();
            setDemoMode(j._demo === true);
            toast(formatTpl(t("page.company.portal.toast.ping_ok"), { preview: JSON.stringify(j).slice(0, 120) }), "success");
        } catch (e) {
            toast(formatTpl(t("page.company.portal.toast.ping_err"), { error: errorMessage(e) }), "error");
        } finally {
            setPingBusy(false);
        }
    };

    const openBilling = async () => {
        setBillingBusy(true);
        try {
            const url = await companyPortalBillingPortalUrl();
            window.open(url, "_blank", "noopener,noreferrer");
        } catch (e) {
            toast(formatTpl(t("page.company.portal.toast.billing_err"), { error: errorMessage(e) }), "error");
        } finally {
            setBillingBusy(false);
        }
    };

    const demoBanner = demoMode ? (
        <DismissibleNotice
            variant="warning"
            dismissKey="company-portal-demo-mode"
            className={embedded ? undefined : "company-portal-demo-notice"}
            title={t("page.company.portal.demo_title")}
        >
            {t("page.company.portal.demo_body")}
        </DismissibleNotice>
    ) : null;

    const heading = (
        <>
            <div className="card-title">{t("page.company.portal.title")}</div>
            <div className="card-sub">
                {t("page.company.portal.subtitle_lead")}{" "}
                <Mono>medoc-company-server</Mono>
                {t("page.company.portal.subtitle_tail")}
            </div>
        </>
    );

    const body = (
        <>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 0 }}>
                <Input
                    id="cp-base-url"
                    label={t("page.company.portal.label_base_url")}
                    value={cfg.base_url}
                    onChange={(e) => setCfg((c) => ({ ...c, base_url: e.target.value }))}
                    placeholder={t("page.company.portal.placeholder_base_url")}
                />
                <Input
                    id="cp-slug"
                    label={t("page.company.portal.label_practice_slug")}
                    value={cfg.practice_slug}
                    onChange={(e) => setCfg((c) => ({ ...c, practice_slug: e.target.value }))}
                    placeholder={t("page.company.portal.placeholder_practice_slug")}
                />
                <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <Input
                            id="cp-api-key"
                            label={t("page.company.portal.label_api_key")}
                            type={showKey ? "text" : "password"}
                            autoComplete="off"
                            value={cfg.api_key}
                            onChange={(e) => setCfg((c) => ({ ...c, api_key: e.target.value }))}
                            placeholder={t("page.company.portal.placeholder_api_key")}
                        />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowKey((v) => !v)}>
                        {showKey ? t("page.company.portal.hide_key") : t("page.company.portal.show_key")}
                    </Button>
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Button type="button" onClick={() => void saveCfg()} loading={busy} disabled={busy}>
                        {t("common.save")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void ping()} loading={pingBusy} disabled={pingBusy}>
                        {t("page.company.portal.test_btn")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void openBilling()} loading={billingBusy} disabled={billingBusy}>
                        {t("page.company.portal.billing_btn")}
                    </Button>
                </div>
                <p className="card-sub" style={{ margin: "12px 0 0", lineHeight: 1.5 }}>
                    <strong>{t("page.company.portal.payment_hint_title")}</strong> {t("page.company.portal.payment_hint_body")}
                </p>
            </div>
        </>
    );

    if (embedded) {
        return (
            <div className="settings-system-block">
                <div className="settings-system-block__head">{heading}</div>
                <div className="settings-system-block__body">
                    {demoBanner}
                    {body}
                </div>
            </div>
        );
    }

    return (
        <>
            {demoBanner}
            <div className="card-head" style={{ marginTop: 12 }}>
                <div>{heading}</div>
            </div>
            {body}
        </>
    );
}
