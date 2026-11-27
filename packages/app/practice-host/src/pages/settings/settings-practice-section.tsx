import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/settings-page.controller";
import {
    getInvoicePracticeFromStorage,
    hydrateInvoicePracticeFromAppKv,
    isValidPracticeDigitId,
    isValidPracticeIban,
    practiceInvoiceRequiredMissing,
    saveInvoicePracticeToStorage,
    syncInvoicePracticeToAppKv,
    type InvoicePractice,
} from "@/lib/invoice-service-item";
import { formatPracticeOpeningHours, readPracticeWorkHoursConfig, type PracticeDayKey } from "@/lib/practice-planning";
import { usePracticeWorkHoursStore } from "@/models/store/practice-work-hours-store";
import { bcp47ForLocale, useLocale } from "@/lib/i18n";
import { timeZoneOptionLabel } from "@/lib/time-zone-label";
import { errorMessage } from "@/lib/utils";
import { PRACTICE_CURRENCIES, normalizePracticeCurrency } from "@/lib/practice-currency";
import {
    DEFAULT_PRACTICE_TIMEZONE,
    hydratePracticeTimezoneFromAppKv,
    mirrorPracticeTimezoneLocal,
    practiceTimezone,
} from "@/lib/practice-timezone";
import { UploadCircleIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input, Select } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { translateLocale, useT, useTParams } from "@/lib/i18n";
import { practiceCountry } from "@/lib/document-header-layout";
import { SettingsPracticeBillingSection } from "./settings-practice-billing";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { logoPlacementOf, formatAddrOneLine, rasterizeLogoToPngBase64 } from "./practice-logo-raster";
import type { PracticeLogoPlacement, PracticeLogoRecord } from "./practice-logo-raster";

export type SettingsPracticeSectionProps = {
    sessionUserId: string | undefined;
    /** Edit master data (invoice, logo, KV) — ops.system / practice management. */
    canEditPractice?: boolean;
};

export function SettingsPracticeSection({
    sessionUserId,
    canEditPractice = true,
}: SettingsPracticeSectionProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const [editPracticeName, setEditPracticeName] = useState(false);
    const [draftPracticeName, setDraftPracticeName] = useState("");
    const [editPracticeAddr, setEditPracticeAddr] = useState(false);
    const [draftPracticeAddr, setDraftPracticeAddr] = useState("");
    const [editPracticeKv, setEditPracticeKv] = useState(false);
    const [draftPracticeKv, setDraftPracticeKv] = useState("");
    const [editPracticeFax, setEditPracticeFax] = useState(false);
    const [draftPracticeFax, setDraftPracticeFax] = useState("");
    const [showLogoOnDocuments, setShowLogoOnDocuments] = useState(true);
    const [logoPlacement, setLogoPlacement] = useState<PracticeLogoPlacement>("side");
    const [editPracticeExtra, setEditPracticeExtra] = useState(false);
    const [practiceExtraSnapshot, setPracticeExtraSnapshot] = useState<InvoicePractice | null>(null);
    const [editPracticeBilling, setEditPracticeBilling] = useState(false);
    const [practiceBillingSnapshot, setPracticeBillingSnapshot] = useState<InvoicePractice | null>(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [practice, setPractice] = useState<InvoicePractice>(() => getInvoicePracticeFromStorage());
    const [practiceReady, setPracticeReady] = useState(false);
    const workHours = usePracticeWorkHoursStore((s) => s.config);
    const locale = useLocale((s) => s.locale);
    const openingHoursSummary = useMemo(() => {
        const cfg = workHours ?? readPracticeWorkHoursConfig();
        return formatPracticeOpeningHours(cfg, (key: PracticeDayKey) => translateLocale(locale, `page.workTime.day_short.${key}`));
    }, [locale, workHours]);
    const [timezone, setTimezone] = useState(() => practiceTimezone());
    const timeZones = useMemo(() => {
        const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
        try {
            const zones = intl.supportedValuesOf?.("timeZone") ?? [DEFAULT_PRACTICE_TIMEZONE];
            return zones.includes(DEFAULT_PRACTICE_TIMEZONE)
                ? zones
                : [DEFAULT_PRACTICE_TIMEZONE, ...zones];
        } catch {
            return [DEFAULT_PRACTICE_TIMEZONE];
        }
    }, []);
    const timeZoneOptions = useMemo(() => {
        const tag = bcp47ForLocale(locale);
        const list = timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones];
        return list
            .map((zone) => ({ value: zone, label: timeZoneOptionLabel(zone, tag) }))
            .sort((a, b) => a.label.localeCompare(b.label, locale));
    }, [locale, timeZones, timezone]);

    useEffect(() => {
        let c = false;
        void (async () => {
            try {
                const raw = await getAppKv("practice.logo.v1");
                if (c || !raw) return;
                const j = JSON.parse(raw) as PracticeLogoRecord;
                const show = j.showOnDocuments !== false;
                const placement = logoPlacementOf(j.placement);
                setShowLogoOnDocuments(show);
                setLogoPlacement(placement);
                if (j.mime && j.data) {
                    setLogoPreviewUrl(`data:${j.mime};base64,${j.data}`);
                }
            } catch {
                /* Web / missing */
            }
        })();
        return () => {
            c = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        void hydratePracticeTimezoneFromAppKv(() => getAppKv("practice.timezone.v1")).then((zone) => {
            if (!cancelled) setTimezone(zone);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const editingPractice =
            editPracticeName ||
            editPracticeAddr ||
            editPracticeKv ||
            editPracticeFax ||
            editPracticeExtra ||
            editPracticeBilling;
        if (!sessionUserId || editingPractice) return;
        let cancelled = false;
        void hydrateInvoicePracticeFromAppKv().then((fromKv) => {
            if (cancelled) return;
            if (fromKv) {
                setPractice(fromKv);
                setDraftPracticeName(fromKv.name);
                setDraftPracticeAddr(fromKv.addr);
                setDraftPracticeKv(fromKv.kv_number ?? "");
                setPracticeReady(true);
                return;
            }
            try {
                if (localStorage.getItem("medoc-invoice-practice-v1")?.trim()) setPracticeReady(true);
            } catch {
                /* private mode */
            }
        });
        return () => {
            cancelled = true;
        };
    }, [
        sessionUserId,
        editPracticeName,
        editPracticeAddr,
        editPracticeKv,
        editPracticeFax,
        editPracticeExtra,
        editPracticeBilling,
    ]);

    function applyPracticePatch(patch: Partial<InvoicePractice>) {
        setPractice((p) => {
            const next = { ...p, ...patch };
            saveInvoicePracticeToStorage(next);
            void syncInvoicePracticeToAppKv(next).catch((e) => {
                toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
            });
            return next;
        });
    }

    function savePracticeName() {
        const name = draftPracticeName.trim();
        if (!name) {
            toast(t("settings.practice.toast.name_required"), "error");
            return;
        }
        const previous = practice.name;
        applyPracticePatch({ name });
        toast(t("settings.practice.toast.name_saved"), "success", {
            onUndo: () => {
                applyPracticePatch({ name: previous });
                setDraftPracticeName(previous);
            },
        });
        setEditPracticeName(false);
    }

    function savePracticeAddr() {
        const addr = draftPracticeAddr.trim();
        if (!addr) {
            toast(t("settings.practice.toast.address_required"), "error");
            return;
        }
        const previous = practice.addr;
        applyPracticePatch({ addr: draftPracticeAddr });
        toast(t("settings.practice.toast.address_saved"), "success", {
            onUndo: () => {
                applyPracticePatch({ addr: previous });
                setDraftPracticeAddr(previous);
            },
        });
        setEditPracticeAddr(false);
    }

    useEffect(() => {
        if (!practiceReady || !openingHoursSummary) return;
        if (editPracticeName || editPracticeAddr || editPracticeKv || editPracticeFax || editPracticeExtra || editPracticeBilling) return;
        if ((practice.opening_hours ?? "").trim() === openingHoursSummary) return;
        applyPracticePatch({ opening_hours: openingHoursSummary });
    }, [
        editPracticeAddr,
        editPracticeBilling,
        editPracticeExtra,
        editPracticeFax,
        editPracticeKv,
        editPracticeName,
        openingHoursSummary,
        practice.opening_hours,
        practiceReady,
    ]);

    function savePracticeKv() {
        const kv = draftPracticeKv.trim();
        if (!kv) {
            toast(t("settings.practice.toast.kv_required"), "error");
            return;
        }
        const previous = practice.kv_number;
        applyPracticePatch({ kv_number: kv });
        toast(t("settings.practice.toast.kv_saved"), "success", {
            onUndo: () => {
                applyPracticePatch({ kv_number: previous });
                setDraftPracticeKv(previous ?? "");
            },
        });
        setEditPracticeKv(false);
    }

    function savePracticeFax() {
        const fax = draftPracticeFax.trim();
        const previous = practice.fax;
        applyPracticePatch({ fax: fax || undefined });
        toast(t("settings.practice.toast.contact_saved"), "success", {
            onUndo: () => {
                applyPracticePatch({ fax: previous });
                setDraftPracticeFax(previous ?? "");
            },
        });
        setEditPracticeFax(false);
    }

    async function savePracticeLogo(patch: Partial<PracticeLogoRecord>): Promise<PracticeLogoRecord> {
        const raw = await getAppKv("practice.logo.v1");
        const current: PracticeLogoRecord = raw ? (JSON.parse(raw) as PracticeLogoRecord) : {};
        const next: PracticeLogoRecord = {
            ...current,
            ...patch,
            placement: logoPlacementOf(patch.placement ?? current.placement),
            showOnDocuments: patch.showOnDocuments ?? current.showOnDocuments !== false,
        };
        await setAppKv("practice.logo.v1", JSON.stringify(next));
        return next;
    }

    async function onShowLogoChange(next: boolean) {
        const previous = showLogoOnDocuments;
        setShowLogoOnDocuments(next);
        try {
            await savePracticeLogo({ showOnDocuments: next, placement: logoPlacement });
        } catch (err) {
            setShowLogoOnDocuments(previous);
            toast(tp("settings.practice.toast.logo_failed", { message: errorMessage(err) }), "error");
        }
    }

    async function onLogoPlacementChange(next: PracticeLogoPlacement) {
        const previous = logoPlacement;
        setLogoPlacement(next);
        try {
            await savePracticeLogo({ showOnDocuments: showLogoOnDocuments, placement: next });
        } catch (err) {
            setLogoPlacement(previous);
            toast(tp("settings.practice.toast.logo_failed", { message: errorMessage(err) }), "error");
        }
    }

    function startEditPracticeExtra() {
        setPracticeExtraSnapshot({ ...practice });
        setEditPracticeExtra(true);
    }

    function cancelPracticeExtra() {
        if (practiceExtraSnapshot) setPractice(practiceExtraSnapshot);
        setEditPracticeExtra(false);
        setPracticeExtraSnapshot(null);
    }

    function savePracticeExtra() {
        const previous = practiceExtraSnapshot ? { ...practiceExtraSnapshot } : null;
        const saved = practice;
        saveInvoicePracticeToStorage(saved);
        void syncInvoicePracticeToAppKv(saved).catch((e) => {
            toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
        });
        toast(t("settings.practice.toast.contact_saved"), "success", {
            onUndo: previous
                ? () => {
                      setPractice(previous);
                      saveInvoicePracticeToStorage(previous);
                      void syncInvoicePracticeToAppKv(previous).catch((e) => {
                          toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
                      });
                  }
                : undefined,
        });
        setEditPracticeExtra(false);
        setPracticeExtraSnapshot(null);
    }

    const practiceBillingIncomplete = useMemo(() => practiceInvoiceRequiredMissing(practice), [practice]);

    function startEditPracticeBilling() {
        setPracticeBillingSnapshot({ ...practice });
        setEditPracticeBilling(true);
    }

    function cancelPracticeBilling() {
        if (practiceBillingSnapshot) setPractice(practiceBillingSnapshot);
        setEditPracticeBilling(false);
        setPracticeBillingSnapshot(null);
    }

    function savePracticeBilling() {
        const zanr = (practice.zanr ?? "").trim();
        const bsnr = (practice.bsnr ?? "").trim();
        const iban = (practice.bank_iban ?? "").trim();
        if (zanr && !isValidPracticeDigitId(zanr)) {
            toast(t("settings.practice.toast.zanr_invalid"), "error");
            return;
        }
        if (bsnr && !isValidPracticeDigitId(bsnr)) {
            toast(t("settings.practice.toast.bsnr_invalid"), "error");
            return;
        }
        if (iban && !isValidPracticeIban(iban)) {
            toast(t("settings.practice.toast.iban_invalid"), "error");
            return;
        }
        const previous = practiceBillingSnapshot ? { ...practiceBillingSnapshot } : null;
        const zt = practice.payment_terms_days ?? 14;
        const next: InvoicePractice = {
            ...practice,
            payment_terms_days: Number.isFinite(zt) && zt > 0 ? Math.round(zt) : 14,
            vat_exemption_notice:
                (practice.vat_exemption_notice ?? "").trim() || t("settings.practice.vat_exemption_default"),
        };
        setPractice(next);
        saveInvoicePracticeToStorage(next);
        void syncInvoicePracticeToAppKv(next).catch((e) => {
            toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
        });
        toast(t("settings.practice.toast.billing_saved"), "success", {
            onUndo: previous
                ? () => {
                      setPractice(previous);
                      saveInvoicePracticeToStorage(previous);
                      void syncInvoicePracticeToAppKv(previous).catch((e) => {
                          toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
                      });
                  }
                : undefined,
        });
        setEditPracticeBilling(false);
        setPracticeBillingSnapshot(null);
    }

    async function onPracticeLogoFile(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 2_000_000) {
            toast(t("settings.practice.toast.file_too_large"), "error");
            return;
        }
        setLogoBusy(true);
        try {
            const { mime, data } = await rasterizeLogoToPngBase64(f, t);
            // ~750 KB base64 ≈ raw PNG under common practice-logo sizes after rasterize.
            if (data.length > 1_000_000) {
                toast(t("settings.practice.toast.file_too_large"), "error");
                return;
            }
            await savePracticeLogo({ mime, data, showOnDocuments: showLogoOnDocuments, placement: logoPlacement });
            setLogoPreviewUrl(`data:${mime};base64,${data}`);
            toast(t("settings.practice.toast.logo_saved"), "success");
        } catch (err) {
            toast(tp("settings.practice.toast.logo_failed", { message: errorMessage(err) }), "error");
        } finally {
            setLogoBusy(false);
        }
    }

    return (
        <>
    <section className="settings-subcard">
        <div className="card-head">
            <div>
                <div className="card-title">{t("settings.nav.practice")}</div>
                <p className="card-sub">
                    {canEditPractice ? t("settings.practice.subtitle_edit") : t("settings.practice.subtitle_readonly")}
                </p>
            </div>
        </div>
        {canEditPractice && practiceBillingIncomplete ? (
            <DismissibleNotice
                variant="warning"
                dismissKey="practice-billing-incomplete"
                className="settings-practice-billing-notice"
                title={t("settings.practice.billing_notice_title")}
                subtitle={t("settings.practice.billing_notice_subtitle")}
            />
        ) : null}
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.timezone_label")}</b>
                </span>
                <div className="settings-row-muted">{t("settings.practice.timezone_hint")}</div>
            </div>
            <Select
                className="settings-timezone-select"
                menuClassName="settings-timezone-menu"
                menuFitContent
                menuContainSelector=".settings-subcard"
                value={timezone}
                disabled={!canEditPractice}
                aria-label={t("settings.practice.timezone_label")}
                options={timeZoneOptions}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const next = e.target.value;
                    // Update local cache + subscribers first so the rest of the UI
                    // refreshes even if the app_kv write is slow or fails.
                    setTimezone(mirrorPracticeTimezoneLocal(next));
                    void setAppKv("practice.timezone.v1", next)
                        .then(() => toast(t("settings.practice.toast.timezone_saved"), "success"))
                        .catch((err) => toast(errorMessage(err), "error"));
                }}
            />
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.country")}</b>
                </span>
                <div className="settings-row-muted">{t("settings.practice.country_hint")}</div>
            </div>
            <Select
                className="settings-timezone-select"
                value={practice.country ?? ""}
                disabled={!canEditPractice}
                aria-label={t("settings.practice.country")}
                options={["", "MA", "FR", "DE", "EU"].map((code) => ({ value: code, label: t(`settings.practice.country_${code || "auto"}`) }))}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const country = e.target.value || undefined;
                    // Morocco bills in dirhams, the others in euros; the currency can still be changed below.
                    const currency = country === "MA" ? "MAD" : country ? "EUR" : practice.currency;
                    const next = { ...practice, country, currency: normalizePracticeCurrency(currency) };
                    setPractice(next);
                    void saveInvoicePracticeToStorage(next)
                        .then(() => toast(t("settings.practice.toast.country_saved"), "success"))
                        .catch((err) => {
                            toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(err) }), "warning");
                        });
                }}
            />
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.currency")}</b>
                </span>
                <div className="settings-row-muted">{t("settings.practice.currency_hint")}</div>
            </div>
            <Select
                className="settings-timezone-select"
                value={normalizePracticeCurrency(practice.currency)}
                disabled={!canEditPractice}
                aria-label={t("settings.practice.currency")}
                options={PRACTICE_CURRENCIES.map((code) => ({ value: code, label: code }))}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const next = { ...practice, currency: normalizePracticeCurrency(e.target.value) };
                    setPractice(next);
                    void saveInvoicePracticeToStorage(next)
                        .then(() => toast(t("settings.practice.toast.currency_saved"), "success"))
                        .catch((err) => {
                            toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(err) }), "warning");
                        });
                }}
            />
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.name_label")}</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(practice.name ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {canEditPractice && editPracticeName ? (
                    <>
                        <Input
                            value={draftPracticeName}
                            onChange={(e) => setDraftPracticeName(e.target.value)}
                            aria-label={t("settings.practice.name_label")}
                            style={{ minWidth: 160, maxWidth: 280 }}
                        />
                        <Button type="button" onClick={() => void savePracticeName()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPracticeName(practice.name);
                                setEditPracticeName(false);
                            }}
                        >
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : canEditPractice ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPracticeName(practice.name);
                            setEditPracticeName(true);
                        }}
                    >
                        {t("common.edit")}
                    </Button>
                ) : null}
            </div>
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)", flexDirection: "column" }}>
            <div className="row" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span className="settings-field-label">
                        <b>{t("settings.practice.address_label")}</b>
                        <span className="req" aria-hidden>
                            *
                        </span>
                    </span>
                    <div className="settings-row-muted">{formatAddrOneLine(practice.addr) || "—"}</div>
                </div>
                <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {canEditPractice && editPracticeAddr ? (
                        <>
                            <Button type="button" onClick={() => void savePracticeAddr()}>{t("common.save")}</Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setDraftPracticeAddr(practice.addr);
                                    setEditPracticeAddr(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : canEditPractice ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPracticeAddr(practice.addr);
                                setEditPracticeAddr(true);
                            }}
                        >
                            {t("common.edit")}
                        </Button>
                    ) : null}
                </div>
            </div>
            {canEditPractice && editPracticeAddr ? (
                <PracticeAddressArea
                    label={t("settings.practice.edit_address")}
                    placeholder={t("settings.practice.address_placeholder")}
                    hint={t("settings.practice.address_hint")}
                    value={draftPracticeAddr}
                    onChange={setDraftPracticeAddr}
                />
            ) : null}
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.practice.fax")}</b>
                <div className="settings-row-muted">{(practice.fax ?? "").trim() || "—"}</div>
                <div className="card-sub">{t("settings.practice.fax_hint")}</div>
            </div>
            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {canEditPractice && editPracticeFax ? (
                    <>
                        <Input
                            id="px-fax-row"
                            value={draftPracticeFax}
                            onChange={(e) => setDraftPracticeFax(e.target.value)}
                            aria-label={t("settings.practice.fax")}
                            style={{ minWidth: 160, maxWidth: 220 }}
                        />
                        <Button type="button" onClick={() => savePracticeFax()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPracticeFax(practice.fax ?? "");
                                setEditPracticeFax(false);
                            }}
                        >
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : canEditPractice ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPracticeFax(practice.fax ?? "");
                            setEditPracticeFax(true);
                        }}
                    >
                        {t("common.edit")}
                    </Button>
                ) : null}
            </div>
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.practice.hours_label")}</b>
                <div className="settings-row-muted" dir="ltr">{openingHoursSummary || "—"}</div>
                <div className="card-sub">{t("settings.practice.hours_follows")}</div>
            </div>
        </div>
        {/* KV number: German statutory insurance only. */}
        {canEditPractice && practiceCountry(practice) === "DE" ? (
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.kv_label")}</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(practice.kv_number ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPracticeKv ? (
                    <>
                        <Input
                            value={draftPracticeKv}
                            onChange={(e) => setDraftPracticeKv(e.target.value)}
                            aria-label={t("settings.practice.kv_label")}
                            style={{ minWidth: 160, maxWidth: 220 }}
                        />
                        <Button type="button" onClick={() => void savePracticeKv()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPracticeKv(practice.kv_number ?? "");
                                setEditPracticeKv(false);
                            }}
                        >
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPracticeKv(practice.kv_number ?? "");
                            setEditPracticeKv(true);
                        }}
                    >
                        {t("common.edit")}
                    </Button>
                )}
            </div>
        </div>
        ) : null}
        {canEditPractice ? (
        <div className="settings-row" style={{ alignItems: "center" }}>
            <div>
                <b>{t("settings.practice.logo")}</b>
                <div className="card-sub">{t("settings.practice.logo_hint")}</div>
                <div className="row" style={{ gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-2)" }}>
                    <SettingsSwitch
                        checked={showLogoOnDocuments}
                        onChange={(next) => void onShowLogoChange(next)}
                        ariaLabel={t("settings.practice.logo_show")}
                        disabled={logoBusy}
                    />
                    <span>{t("settings.practice.logo_show")}</span>
                </div>
                <div className="card-sub">{t("settings.practice.logo_show_hint")}</div>
                {showLogoOnDocuments ? (
                    <div style={{ marginTop: "var(--space-2)", maxWidth: 220 }}>
                        <Select
                            value={logoPlacement}
                            disabled={logoBusy}
                            aria-label={t("settings.practice.logo_place")}
                            options={[
                                { value: "side", label: t("settings.practice.logo_place_side") },
                                { value: "top", label: t("settings.practice.logo_place_top") },
                            ]}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                                void onLogoPlacementChange(logoPlacementOf(e.target.value))
                            }
                        />
                        <div className="card-sub">{t("settings.practice.logo_place_hint")}</div>
                    </div>
                ) : null}
            </div>
            <div className="row" style={{ gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="" style={{ height: 40, width: "auto", borderRadius: 8, border: "1px solid var(--line-strong)" }} />
                ) : null}
                <input id="practice-logo-file" className="sr-only" type="file" accept="image/*" onChange={(e) => void onPracticeLogoFile(e)} />
                <Button type="button" variant="secondary" loading={logoBusy} disabled={logoBusy} onClick={() => document.getElementById("practice-logo-file")?.click()}>
                    <span className="row" style={{ gap: "var(--space-2)", alignItems: "center" }}>
                        <UploadCircleIcon size={18} />
                        {t("settings.practice.upload")}
                    </span>
                </Button>
            </div>
        </div>
        ) : null}
        {canEditPractice ? (
        <>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.practice.contact_web_tax")}</b>
                <div className="settings-row-muted">{t("settings.practice.contact_web_tax_hint")}</div>
            </div>
            <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPracticeExtra ? (
                    <>
                        <Button type="button" onClick={() => void savePracticeExtra()}>{t("common.save")}</Button>
                        <Button type="button" variant="secondary" onClick={() => void cancelPracticeExtra()}>
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : (
                    <Button type="button" variant="secondary" onClick={() => void startEditPracticeExtra()}>
                        {t("common.edit")}
                    </Button>
                )}
            </div>
        </div>
        {editPracticeExtra ? (
            <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                        id="px-tel"
                        label={t("common.phone")}
                        type="tel"
                        value={practice.phone ?? ""}
                        onChange={(e) => setPractice((p) => ({ ...p, phone: e.target.value }))}
                    />
                    <Input
                        id="px-em"
                        label={t("common.email")}
                        type="email"
                        value={practice.email ?? ""}
                        onChange={(e) => setPractice((p) => ({ ...p, email: e.target.value }))}
                    />
                    <Input id="px-web" label={t("settings.practice.website")} type="url" value={practice.web ?? ""} onChange={(e) => setPractice((p) => ({ ...p, web: e.target.value }))} />
                    <Input id="px-vat-id" label={t("settings.practice.vat_id")} value={practice.vat_id ?? ""} onChange={(e) => setPractice((p) => ({ ...p, vat_id: e.target.value }))} />
                    <Input id="px-st" label={t("settings.practice.tax_number")} value={practice.tax_number ?? ""} onChange={(e) => setPractice((p) => ({ ...p, tax_number: e.target.value }))} />
                </div>
            </div>
        ) : null}
        <SettingsPracticeBillingSection
            practice={practice}
            editing={editPracticeBilling}
            onStartEdit={startEditPracticeBilling}
            onCancel={cancelPracticeBilling}
            onSave={savePracticeBilling}
            onChange={(patch) => setPractice((p) => ({ ...p, ...patch }))}
        />
        </>
        ) : null}
    </section>
        </>
    );
}

function PracticeAddressArea({
    label,
    placeholder,
    hint,
    value,
    onChange,
}: {
    label: string;
    placeholder: string;
    hint: string;
    value: string;
    onChange: (version: string) => void;
}) {
    const id = "practice-addr";
    return (
        <label className="input-wrap" htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span className="input-label">{label}</span>
            <textarea
                id={id}
                className="input-edit settings-practice-addr-ta"
                rows={5}
                autoComplete="street-address"
                spellCheck={false}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <p className="card-sub settings-practice-field-hint" style={{ margin: 0 }}>
                {hint}
            </p>
        </label>
    );
}
