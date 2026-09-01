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
import { errorMessage } from "@/lib/utils";
import { ChevronRightIcon, UploadCircleIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";
import { SettingsPracticeBillingSection } from "./settings-practice-billing";

function formatAddrOneLine(addr: string): string {
    return addr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
}

export type SettingsPracticeSectionProps = {
    sessionUserId: string | undefined;
    onOpenWorkflows: () => void;
    /** Edit master data (invoice, logo, KV) — ops.system / practice management. */
    canEditPractice?: boolean;
};

export function SettingsPracticeSection({
    sessionUserId,
    onOpenWorkflows,
    canEditPractice = true,
}: SettingsPracticeSectionProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const [editPracticeName, setEditPracticeName] = useState(false);
    const [draftPracticeName, setDraftPracticeName] = useState("");
    const [editPracticeAddr, setEditPracticeAddr] = useState(false);
    const [draftPracticeAddr, setDraftPracticeAddr] = useState("");
    const [editPracticeOpeningHours, setEditPracticeOpeningHours] = useState(false);
    const [draftPracticeOpeningHours, setDraftPracticeOpeningHours] = useState("");
    const [editPracticeKv, setEditPracticeKv] = useState(false);
    const [draftPracticeKv, setDraftPracticeKv] = useState("");
    const [editPracticeExtra, setEditPracticeExtra] = useState(false);
    const [practiceExtraSnapshot, setPracticeExtraSnapshot] = useState<InvoicePractice | null>(null);
    const [editPracticeBilling, setEditPracticeBilling] = useState(false);
    const [practiceBillingSnapshot, setPracticeBillingSnapshot] = useState<InvoicePractice | null>(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [practice, setPractice] = useState<InvoicePractice>(() => getInvoicePracticeFromStorage());

    useEffect(() => {
        let c = false;
        void (async () => {
            try {
                const raw = await getAppKv("practice.logo.v1");
                if (c || !raw) return;
                const j = JSON.parse(raw) as { mime?: string; data?: string };
                if (j.mime && j.data) setLogoPreviewUrl(`data:${j.mime};base64,${j.data}`);
            } catch {
                /* Web / missing */
            }
        })();
        return () => {
            c = true;
        };
    }, []);

    useEffect(() => {
        const editingPractice =
            editPracticeName ||
            editPracticeAddr ||
            editPracticeOpeningHours ||
            editPracticeKv ||
            editPracticeExtra ||
            editPracticeBilling;
        if (!sessionUserId || editingPractice) return;
        let cancelled = false;
        void hydrateInvoicePracticeFromAppKv().then((fromKv) => {
            if (cancelled || !fromKv) return;
            setPractice(fromKv);
            setDraftPracticeName(fromKv.name);
            setDraftPracticeAddr(fromKv.addr);
            setDraftPracticeOpeningHours(fromKv.opening_hours ?? "");
            setDraftPracticeKv(fromKv.kv_number ?? "");
        });
        return () => {
            cancelled = true;
        };
    }, [
        sessionUserId,
        editPracticeName,
        editPracticeAddr,
        editPracticeOpeningHours,
        editPracticeKv,
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
        applyPracticePatch({ name });
        toast(t("settings.practice.toast.name_saved"), "success");
        setEditPracticeName(false);
    }

    function savePracticeAddr() {
        const addr = draftPracticeAddr.trim();
        if (!addr) {
            toast(t("settings.practice.toast.address_required"), "error");
            return;
        }
        applyPracticePatch({ addr: draftPracticeAddr });
        toast(t("settings.practice.toast.address_saved"), "success");
        setEditPracticeAddr(false);
    }

    function savePracticeOpeningHours() {
        applyPracticePatch({ opening_hours: draftPracticeOpeningHours.trim() || undefined });
        toast(t("settings.practice.toast.hours_saved"), "success");
        setEditPracticeOpeningHours(false);
    }

    function savePracticeKv() {
        const kv = draftPracticeKv.trim();
        if (!kv) {
            toast(t("settings.practice.toast.kv_required"), "error");
            return;
        }
        applyPracticePatch({ kv_number: kv });
        toast(t("settings.practice.toast.kv_saved"), "success");
        setEditPracticeKv(false);
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
        saveInvoicePracticeToStorage(practice);
        void syncInvoicePracticeToAppKv(practice).catch((e) => {
            toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
        });
        toast(t("settings.practice.toast.contact_saved"), "success");
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
        const zt = practice.payment_terms_days ?? 14;
        const next: InvoicePractice = {
            ...practice,
            payment_terms_days: Number.isFinite(zt) && zt > 0 ? Math.round(zt) : 14,
            vat_exemption_notice:
                (practice.vat_exemption_notice ?? "").trim() || "VAT-exempt under § 4 No. 14 UStG",
        };
        setPractice(next);
        saveInvoicePracticeToStorage(next);
        void syncInvoicePracticeToAppKv(next).catch((e) => {
            toast(tp("settings.practice.toast.sync_failed", { message: errorMessage(e) }), "warning");
        });
        toast(t("settings.practice.toast.billing_saved"), "success");
        setEditPracticeBilling(false);
        setPracticeBillingSnapshot(null);
    }

    async function onPracticeLogoFile(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 750_000) {
            toast(t("settings.practice.toast.file_too_large"), "error");
            return;
        }
        setLogoBusy(true);
        try {
            const buf = await f.arrayBuffer();
            let bin = "";
            const bytes = new Uint8Array(buf);
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
            const data = btoa(bin);
            const mime = f.type && f.type.startsWith("image/") ? f.type : "image/png";
            await setAppKv("practice.logo.v1", JSON.stringify({ mime, data }));
            setLogoPreviewUrl(`data:${mime};base64,${data}`);
            toast(t("settings.practice.toast.logo_saved"), "success");
        } catch (err) {
            toast(tp("settings.practice.toast.logo_failed", { message: err instanceof Error ? err.message : String(err) }), "error");
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
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.name_label")}</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(practice.name ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
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
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12, flexDirection: "column" }}>
            <div className="row" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span className="settings-field-label">
                        <b>{t("settings.practice.address_label")}</b>
                        <span className="req" aria-hidden>
                            *
                        </span>
                    </span>
                    <div className="settings-row-muted">{formatAddrOneLine(practice.addr) || "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
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
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.practice.hours_label")}</b>
                <div className="settings-row-muted">{(practice.opening_hours ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {canEditPractice && editPracticeOpeningHours ? (
                    <>
                        <Input
                            value={draftPracticeOpeningHours}
                            onChange={(e) => setDraftPracticeOpeningHours(e.target.value)}
                            aria-label={t("settings.practice.hours_label")}
                            placeholder={t("settings.practice.hours_placeholder")}
                            style={{ minWidth: 160, maxWidth: 320 }}
                        />
                        <Button type="button" onClick={() => void savePracticeOpeningHours()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPracticeOpeningHours(practice.opening_hours ?? "");
                                setEditPracticeOpeningHours(false);
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
                            setDraftPracticeOpeningHours(practice.opening_hours ?? "");
                            setEditPracticeOpeningHours(true);
                        }}
                    >
                        {t("common.edit")}
                    </Button>
                ) : null}
            </div>
        </div>
        {canEditPractice ? (
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.practice.kv_label")}</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(practice.kv_number ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
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
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="" style={{ height: 40, width: "auto", borderRadius: 8, border: "1px solid var(--line-strong)" }} />
                ) : null}
                <input id="practice-logo-file" className="sr-only" type="file" accept="image/*" onChange={(e) => void onPracticeLogoFile(e)} />
                <Button type="button" variant="secondary" loading={logoBusy} disabled={logoBusy} onClick={() => document.getElementById("practice-logo-file")?.click()}>
                    <span className="row" style={{ gap: 8, alignItems: "center" }}>
                        <UploadCircleIcon size={18} />
                        {t("settings.practice.upload")}
                    </span>
                </Button>
            </div>
        </div>
        ) : null}
        {canEditPractice ? (
        <>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.practice.contact_web_tax")}</b>
                <div className="settings-row-muted">{t("settings.practice.contact_web_tax_hint")}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
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
                    <Input id="px-fax" label={t("settings.practice.fax")} value={practice.fax ?? ""} onChange={(e) => setPractice((p) => ({ ...p, fax: e.target.value }))} />
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
        <button type="button" className="settings-row-clickable" onClick={() => onOpenWorkflows()}>
            <div>
                <b>{t("settings.practice.appointments_calendar")}</b>
                <div className="settings-row-muted">{t("settings.practice.appointments_calendar_hint")}</div>
            </div>
            <span className="settings-chevron" aria-hidden>
                <ChevronRightIcon size={18} />
            </span>
        </button>
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
        <label className="input-wrap" htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
