import {
    companyPortalBillingPortalUrl,
    openSubscriptionPortal,
    type LicenseStatus,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { formatDeDateShort, formatEurFromCents } from "@/lib/settings-format";
import { ChevronRightIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { MAX_TOTAL_PERSONAL } from "@/lib/mvp-security-config";
import { useT, useTParams } from "@/lib/i18n";
import {
    LICENSE_BILLING_CONNECTORS_ENABLED,
    LICENSE_KBV_ROW_ENABLED,
    LICENSE_SUPPORT_ROW_ENABLED,
    LICENSE_USAGE_METERS_ENABLED,
} from "@/lib/v1-ui-flags";

export type EinstellungenLizenzSectionProps = {
    portalSummary: Record<string, unknown> | null;
    portalFetchBusy: boolean;
    licenseToken: string;
    onLicenseTokenChange: (value: string) => void;
    licenseStatus: LicenseStatus | null;
    licBusy: boolean;
    onVerifyLicense: () => void | Promise<void>;
    onActivateLicense: () => void | Promise<void>;
    canClearLicense?: boolean;
    onClearLicense?: () => void | Promise<void>;
};

export function EinstellungenLizenzSection({
    portalSummary,
    portalFetchBusy,
    licenseToken,
    onLicenseTokenChange,
    licenseStatus,
    licBusy,
    onVerifyLicense,
    onActivateLicense,
    canClearLicense = false,
    onClearLicense,
}: EinstellungenLizenzSectionProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();

    const activeV2 = licenseStatus?.valid ? licenseStatus.licenseV2 : null;
    const activeV1 = licenseStatus?.valid ? licenseStatus.license : null;
    const localCustomerId = activeV2?.customerId?.trim() || activeV1?.customerId?.trim() || "";

    const portalConnected = portalSummary != null;

    const portalLicId = portalConnected
        ? typeof portalSummary.practice_slug === "string" && portalSummary.practice_slug.trim()
            ? `MD-PORTAL-${portalSummary.practice_slug.trim().toUpperCase()}`
            : localCustomerId
              ? `MD-${localCustomerId.toUpperCase()}`
              : t("common.dash")
        : localCustomerId
          ? `MD-${localCustomerId.toUpperCase()}`
          : t("common.dash");

    const desktopLicenseSummary = activeV2
        ? [
              activeV2.edition,
              activeV2.deviceId
                  ? tp("settings.license.device_suffix", { id: activeV2.deviceId.slice(0, 8) })
                  : null,
              activeV2.customerId || null,
          ]
              .filter(Boolean)
              .join(" · ")
        : activeV1
          ? [
                activeV1.edition,
                activeV1.customerId || null,
                activeV1.expiresAt
                    ? tp("settings.license.valid_until", { date: formatDeDateShort(activeV1.expiresAt) })
                    : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : t("settings.license.no_valid");
    const portalRawMax =
        typeof portalSummary?.max_users === "number" ? portalSummary.max_users : MAX_TOTAL_PERSONAL;
    const portalMaxUsers = Math.min(portalRawMax, MAX_TOTAL_PERSONAL);
    const portalActiveUsers = typeof portalSummary?.active_users === "number" ? portalSummary.active_users : 1;
    const userBarPct = portalMaxUsers > 0 ? Math.min(100, Math.round((portalActiveUsers / portalMaxUsers) * 100)) : 50;
    const portalStorageGb = typeof portalSummary?.storage_gb === "number" ? portalSummary.storage_gb : 100;
    const portalStorageUsed = typeof portalSummary?.storage_used_gb === "number" ? portalSummary.storage_used_gb : 0;
    const storageBarPct =
        portalStorageGb > 0 ? Math.min(100, Math.round((portalStorageUsed / portalStorageGb) * 100)) : 0;
    const erUsed = typeof portalSummary?.erezept_month_used === "number" ? portalSummary.erezept_month_used : 0;
    const erQuota = typeof portalSummary?.erezept_month_quota === "number" ? portalSummary.erezept_month_quota : 0;
    const erLabel = erQuota > 0 ? `${erUsed} / ${erQuota}` : portalConnected ? `${erUsed} / ∞` : t("common.dash");
    const erBarPct = erQuota > 0 ? Math.min(100, Math.round((erUsed / erQuota) * 100)) : 0;

    const planTitle =
        typeof portalSummary?.plan_name === "string" && portalSummary.plan_name.trim()
            ? portalSummary.plan_name.trim()
            : null;

    const heroSub = portalConnected
        ? tp("settings.license.hero_with_portal", {
              name:
                  typeof portalSummary.display_name === "string" ? portalSummary.display_name : "Praxis",
              max: portalMaxUsers,
              storage: portalStorageGb,
          })
        : tp("settings.license.hero_fallback", { max: MAX_TOTAL_PERSONAL });

    return (
        <>
            <section className="settings-subcard settings-license-hero-wrap" style={{ overflow: "hidden", padding: 0 }}>
                <div className="settings-license-hero">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span className="settings-pill-accent">{portalFetchBusy ? "…" : licenseStatus?.valid ? t("settings.license.status_active") : t("settings.license.inactive")}</span>
                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("settings.license.plan_label")}</span>
                    </div>
                    <p style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
                        {planTitle ?? (
                            <>
                                {t("settings.license.pro")}
                            </>
                        )}
                    </p>
                    <p className="card-sub" style={{ margin: "8px 0 0", maxWidth: "42rem" }}>
                        {heroSub}
                    </p>
                    {!portalConnected ? (
                        <p className="card-sub" style={{ margin: "8px 0 0", color: "var(--fg-3)" }}>
                            {t("settings.license.portal_not_connected")}
                        </p>
                    ) : null}
                    <div className="settings-license-hero__grid">
                        <div className="settings-license-metric">
                            {t("settings.license.monthly_fee")}
                            <strong>
                                {portalConnected
                                    ? formatEurFromCents(portalSummary.monthly_fee_cents)
                                    : t("common.dash")}
                            </strong>
                        </div>
                        <div className="settings-license-metric">
                            {t("settings.license.next_billing")}
                            <strong>
                                {portalConnected
                                    ? formatDeDateShort(portalSummary.next_billing_iso)
                                    : t("common.dash")}
                            </strong>
                        </div>
                        {LICENSE_BILLING_CONNECTORS_ENABLED ? (
                            <div className="settings-license-metric">
                                {t("settings.license.payment_method")}
                                <strong>{portalSummary ? t("settings.license.billing_portal") : t("settings.license.sepa_demo")}</strong>
                            </div>
                        ) : null}
                    </div>
                    {LICENSE_BILLING_CONNECTORS_ENABLED ? (
                    <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={async () => {
                                try {
                                    const url = await companyPortalBillingPortalUrl();
                                    window.open(url, "_blank", "noopener,noreferrer");
                                } catch {
                                    toast(t("v1.billing.manufacturer_portal_hint"), "info");
                                }
                            }}
                        >
                            {t("settings.license.invoices_btn")}
                        </Button>
                        <Button
                            type="button"
                            onClick={async () => {
                                try {
                                    const p = await openSubscriptionPortal();
                                    window.open(p.url, "_blank", "noopener,noreferrer");
                                } catch {
                                    toast(t("v1.billing.portal_unavailable"), "info");
                                }
                            }}
                        >
                            {t("settings.license.change_plan")}
                        </Button>
                    </div>
                    ) : null}
                </div>
            </section>
            {LICENSE_USAGE_METERS_ENABLED ? (
            <section className="settings-subcard">
                <div className="card-head">
                    <div className="card-title">{t("settings.license.usage_title")}</div>
                </div>
                <div className="card-pad" style={{ display: "grid", gap: 16 }}>
                    <div>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                            <span>{t("settings.license.active_handlers")}</span>
                            <span style={{ fontWeight: 650 }}>
                                {portalActiveUsers} / {portalMaxUsers}
                            </span>
                        </div>
                        <div className="settings-progress" aria-hidden>
                            <span style={{ width: `${userBarPct}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                            <span>{t("settings.license.storage")}</span>
                            <span style={{ fontWeight: 650 }}>
                                {portalStorageUsed} GB / {portalStorageGb} GB
                            </span>
                        </div>
                        <div className="settings-progress" aria-hidden>
                            <span style={{ width: `${storageBarPct}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                            <span>{t("settings.license.erezept_month")}</span>
                            <span style={{ fontWeight: 650 }}>{erLabel}</span>
                        </div>
                        <div className="settings-progress" aria-hidden>
                            <span style={{ width: `${erBarPct}%` }} />
                        </div>
                    </div>
                </div>
            </section>
            ) : null}
            <section className="settings-subcard">
                <div className="card-head">
                    <div className="card-title">{t("settings.license.details_title")}</div>
                </div>
                <div className="settings-row" style={{ alignItems: "flex-start" }}>
                    <div>
                        <b>{t("settings.license.license_number")}</b>
                        <div className="settings-row-muted">{portalLicId}</div>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            void navigator.clipboard?.writeText(portalLicId).then(
                                () => toast(t("common.copied"), "success"),
                                () => toast(t("common.copy_failed_short"), "error"),
                            );
                        }}
                    >
                        {t("common.copy")}
                    </Button>
                </div>
                <div className="settings-row">
                    <div>
                        <b>{t("settings.license.desktop_license")}</b>
                        <div className="settings-row-muted">{desktopLicenseSummary}</div>
                    </div>
                    <span className={licenseStatus?.valid ? "settings-pill-green" : "settings-pill-gray"}>
                        {licenseStatus?.valid ? t("settings.license.status_active") : t("settings.license.inactive")}
                    </span>
                </div>
                {LICENSE_KBV_ROW_ENABLED ? (
                <div className="settings-row">
                    <div>
                        <b>{t("settings.license.kbv_approval")}</b>
                        <div className="settings-row-muted">{t("settings.license.kbv_until")}</div>
                    </div>
                    <span className="settings-pill-green">{t("settings.license.status_active")}</span>
                </div>
                ) : null}
                {LICENSE_SUPPORT_ROW_ENABLED ? (
                <div className="settings-row">
                    <div>
                        <b>{t("settings.license.support_contract")}</b>
                        <div className="settings-row-muted">{t("settings.license.support_detail")}</div>
                    </div>
                    <span className="settings-chevron" aria-hidden>
                        <ChevronRightIcon size={18} />
                    </span>
                </div>
                ) : null}
                <div className="card-pad" style={{ paddingTop: 0 }}>
                    <Input
                        id="lic-token-card"
                        label={t("settings.license.token_label")}
                        value={licenseToken}
                        onChange={(e) => onLicenseTokenChange(e.target.value)}
                        placeholder={t("settings.license.import_ph")}
                    />
                    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={licBusy || !licenseToken.trim()}
                            loading={licBusy}
                            onClick={() => void onVerifyLicense()}
                        >
                            {t("settings.license.verify_btn")}
                        </Button>
                        <Button
                            type="button"
                            disabled={licBusy || !licenseToken.trim()}
                            loading={licBusy}
                            onClick={() => void onActivateLicense()}
                        >
                            {t("settings.license.activate_btn")}
                        </Button>
                        {canClearLicense && licenseStatus?.valid && onClearLicense ? (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={licBusy}
                                loading={licBusy}
                                onClick={() => void onClearLicense()}
                            >
                                {t("settings.license.clear_btn")}
                            </Button>
                        ) : null}
                    </div>
                    {licenseStatus ? (
                        <p
                            style={{
                                color: licenseStatus.valid ? "var(--accent)" : "var(--red)",
                                margin: "8px 0 0",
                                fontSize: 13,
                            }}
                        >
                            {licenseStatus.valid
                                ? tp("settings.license.valid_with_format", { format: licenseStatus.format ?? "?" })
                                : tp("settings.license.invalid", { reason: licenseStatus.reason ?? t("common.error") })}
                        </p>
                    ) : null}
                </div>
            </section>
        </>
    );
}
