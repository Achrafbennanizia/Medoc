import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/settings-page.controller";
import {
    getInvoicePraxisFromStorage,
    hydrateInvoicePraxisFromAppKv,
    isValidPraxisDigitId,
    isValidPraxisIban,
    praxisRechnungPflichtMissing,
    saveInvoicePraxisToStorage,
    syncInvoicePraxisToAppKv,
    type InvoicePraxis,
} from "@/lib/invoice-leistung";
import { errorMessage } from "@/lib/utils";
import { ChevronRightIcon, UploadCircleIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";
import { EinstellungenPraxisBillingSection } from "./einstellungen-praxis-billing";

function formatAddrOneLine(addr: string): string {
    return addr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
}

export type EinstellungenPraxisSectionProps = {
    sessionUserId: string | undefined;
    onOpenArbeitsablaeufe: () => void;
    /** Stammdaten bearbeiten (Rechnung, Logo, KV) — ops.system / Praxisleitung. */
    canEditPraxis?: boolean;
};

export function EinstellungenPraxisSection({
    sessionUserId,
    onOpenArbeitsablaeufe,
    canEditPraxis = true,
}: EinstellungenPraxisSectionProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const [editPraxisName, setEditPraxisName] = useState(false);
    const [draftPraxisName, setDraftPraxisName] = useState("");
    const [editPraxisAddr, setEditPraxisAddr] = useState(false);
    const [draftPraxisAddr, setDraftPraxisAddr] = useState("");
    const [editPraxisOeffnungszeiten, setEditPraxisOeffnungszeiten] = useState(false);
    const [draftPraxisOeffnungszeiten, setDraftPraxisOeffnungszeiten] = useState("");
    const [editPraxisKv, setEditPraxisKv] = useState(false);
    const [draftPraxisKv, setDraftPraxisKv] = useState("");
    const [editPraxisExtra, setEditPraxisExtra] = useState(false);
    const [praxisExtraSnapshot, setPraxisExtraSnapshot] = useState<InvoicePraxis | null>(null);
    const [editPraxisBilling, setEditPraxisBilling] = useState(false);
    const [praxisBillingSnapshot, setPraxisBillingSnapshot] = useState<InvoicePraxis | null>(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [praxis, setPraxis] = useState<InvoicePraxis>(() => getInvoicePraxisFromStorage());

    useEffect(() => {
        let c = false;
        void (async () => {
            try {
                const raw = await getAppKv("praxis.logo.v1");
                if (c || !raw) return;
                const j = JSON.parse(raw) as { mime?: string; data?: string };
                if (j.mime && j.data) setLogoPreviewUrl(`data:${j.mime};base64,${j.data}`);
            } catch {
                /* Web / fehlend */
            }
        })();
        return () => {
            c = true;
        };
    }, []);

    useEffect(() => {
        const editingPraxis =
            editPraxisName ||
            editPraxisAddr ||
            editPraxisOeffnungszeiten ||
            editPraxisKv ||
            editPraxisExtra ||
            editPraxisBilling;
        if (!sessionUserId || editingPraxis) return;
        let cancelled = false;
        void hydrateInvoicePraxisFromAppKv().then((fromKv) => {
            if (cancelled || !fromKv) return;
            setPraxis(fromKv);
            setDraftPraxisName(fromKv.name);
            setDraftPraxisAddr(fromKv.addr);
            setDraftPraxisOeffnungszeiten(fromKv.oeffnungszeiten ?? "");
            setDraftPraxisKv(fromKv.kv_nummer ?? "");
        });
        return () => {
            cancelled = true;
        };
    }, [
        sessionUserId,
        editPraxisName,
        editPraxisAddr,
        editPraxisOeffnungszeiten,
        editPraxisKv,
        editPraxisExtra,
        editPraxisBilling,
    ]);

    function applyPraxisPatch(patch: Partial<InvoicePraxis>) {
        setPraxis((p) => {
            const next = { ...p, ...patch };
            saveInvoicePraxisToStorage(next);
            void syncInvoicePraxisToAppKv(next).catch((e) => {
                toast(tp("settings.praxis.toast.sync_failed", { message: errorMessage(e) }), "warning");
            });
            return next;
        });
    }

    function savePraxisName() {
        const name = draftPraxisName.trim();
        if (!name) {
            toast(t("settings.praxis.toast.name_required"), "error");
            return;
        }
        applyPraxisPatch({ name });
        toast(t("settings.praxis.toast.name_saved"), "success");
        setEditPraxisName(false);
    }

    function savePraxisAddr() {
        const addr = draftPraxisAddr.trim();
        if (!addr) {
            toast(t("settings.praxis.toast.address_required"), "error");
            return;
        }
        applyPraxisPatch({ addr: draftPraxisAddr });
        toast(t("settings.praxis.toast.address_saved"), "success");
        setEditPraxisAddr(false);
    }

    function savePraxisOeffnungszeiten() {
        applyPraxisPatch({ oeffnungszeiten: draftPraxisOeffnungszeiten.trim() || undefined });
        toast(t("settings.praxis.toast.hours_saved"), "success");
        setEditPraxisOeffnungszeiten(false);
    }

    function savePraxisKv() {
        const kv = draftPraxisKv.trim();
        if (!kv) {
            toast(t("settings.praxis.toast.kv_required"), "error");
            return;
        }
        applyPraxisPatch({ kv_nummer: kv });
        toast(t("settings.praxis.toast.kv_saved"), "success");
        setEditPraxisKv(false);
    }

    function startEditPraxisExtra() {
        setPraxisExtraSnapshot({ ...praxis });
        setEditPraxisExtra(true);
    }

    function cancelPraxisExtra() {
        if (praxisExtraSnapshot) setPraxis(praxisExtraSnapshot);
        setEditPraxisExtra(false);
        setPraxisExtraSnapshot(null);
    }

    function savePraxisExtra() {
        saveInvoicePraxisToStorage(praxis);
        void syncInvoicePraxisToAppKv(praxis).catch((e) => {
            toast(tp("settings.praxis.toast.sync_failed", { message: errorMessage(e) }), "warning");
        });
        toast(t("settings.praxis.toast.contact_saved"), "success");
        setEditPraxisExtra(false);
        setPraxisExtraSnapshot(null);
    }

    const praxisBillingIncomplete = useMemo(() => praxisRechnungPflichtMissing(praxis), [praxis]);

    function startEditPraxisBilling() {
        setPraxisBillingSnapshot({ ...praxis });
        setEditPraxisBilling(true);
    }

    function cancelPraxisBilling() {
        if (praxisBillingSnapshot) setPraxis(praxisBillingSnapshot);
        setEditPraxisBilling(false);
        setPraxisBillingSnapshot(null);
    }

    function savePraxisBilling() {
        const zanr = (praxis.zanr ?? "").trim();
        const bsnr = (praxis.bsnr ?? "").trim();
        const iban = (praxis.bankverbindung_iban ?? "").trim();
        if (zanr && !isValidPraxisDigitId(zanr)) {
            toast(t("settings.praxis.toast.zanr_invalid"), "error");
            return;
        }
        if (bsnr && !isValidPraxisDigitId(bsnr)) {
            toast(t("settings.praxis.toast.bsnr_invalid"), "error");
            return;
        }
        if (iban && !isValidPraxisIban(iban)) {
            toast(t("settings.praxis.toast.iban_invalid"), "error");
            return;
        }
        const zt = praxis.zahlungsziel_tage ?? 14;
        const next: InvoicePraxis = {
            ...praxis,
            zahlungsziel_tage: Number.isFinite(zt) && zt > 0 ? Math.round(zt) : 14,
            ust_befreiung_hinweis:
                (praxis.ust_befreiung_hinweis ?? "").trim() || "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG",
        };
        setPraxis(next);
        saveInvoicePraxisToStorage(next);
        void syncInvoicePraxisToAppKv(next).catch((e) => {
            toast(tp("settings.praxis.toast.sync_failed", { message: errorMessage(e) }), "warning");
        });
        toast(t("settings.praxis.toast.billing_saved"), "success");
        setEditPraxisBilling(false);
        setPraxisBillingSnapshot(null);
    }

    async function onPraxisLogoFile(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 750_000) {
            toast(t("settings.praxis.toast.file_too_large"), "error");
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
            await setAppKv("praxis.logo.v1", JSON.stringify({ mime, data }));
            setLogoPreviewUrl(`data:${mime};base64,${data}`);
            toast(t("settings.praxis.toast.logo_saved"), "success");
        } catch (err) {
            toast(tp("settings.praxis.toast.logo_failed", { message: err instanceof Error ? err.message : String(err) }), "error");
        } finally {
            setLogoBusy(false);
        }
    }

    return (
        <>
    <section className="settings-subcard">
        <div className="card-head">
            <div>
                <div className="card-title">{t("settings.nav.praxis")}</div>
                <p className="card-sub">
                    {canEditPraxis ? t("settings.praxis.subtitle_edit") : t("settings.praxis.subtitle_readonly")}
                </p>
            </div>
        </div>
        {canEditPraxis && praxisBillingIncomplete ? (
            <DismissibleNotice
                variant="warning"
                dismissKey="praxis-billing-incomplete"
                className="settings-praxis-billing-notice"
                title={t("settings.praxis.billing_notice_title")}
                subtitle={t("settings.praxis.billing_notice_subtitle")}
            />
        ) : null}
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.praxis.name_label")}</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(praxis.name ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {canEditPraxis && editPraxisName ? (
                    <>
                        <Input
                            value={draftPraxisName}
                            onChange={(e) => setDraftPraxisName(e.target.value)}
                            aria-label={t("settings.praxis.name_label")}
                            style={{ minWidth: 160, maxWidth: 280 }}
                        />
                        <Button type="button" onClick={() => void savePraxisName()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisName(praxis.name);
                                setEditPraxisName(false);
                            }}
                        >
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : canEditPraxis ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPraxisName(praxis.name);
                            setEditPraxisName(true);
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
                        <b>{t("settings.praxis.address_label")}</b>
                        <span className="req" aria-hidden>
                            *
                        </span>
                    </span>
                    <div className="settings-row-muted">{formatAddrOneLine(praxis.addr) || "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {canEditPraxis && editPraxisAddr ? (
                        <>
                            <Button type="button" onClick={() => void savePraxisAddr()}>{t("common.save")}</Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setDraftPraxisAddr(praxis.addr);
                                    setEditPraxisAddr(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : canEditPraxis ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisAddr(praxis.addr);
                                setEditPraxisAddr(true);
                            }}
                        >
                            {t("common.edit")}
                        </Button>
                    ) : null}
                </div>
            </div>
            {canEditPraxis && editPraxisAddr ? (
                <PraxisAddressArea
                    label={t("settings.praxis.edit_address")}
                    placeholder={t("settings.praxis.address_placeholder")}
                    hint={t("settings.praxis.address_hint")}
                    value={draftPraxisAddr}
                    onChange={setDraftPraxisAddr}
                />
            ) : null}
        </div>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.praxis.hours_label")}</b>
                <div className="settings-row-muted">{(praxis.oeffnungszeiten ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {canEditPraxis && editPraxisOeffnungszeiten ? (
                    <>
                        <Input
                            value={draftPraxisOeffnungszeiten}
                            onChange={(e) => setDraftPraxisOeffnungszeiten(e.target.value)}
                            aria-label={t("settings.praxis.hours_label")}
                            placeholder={t("settings.praxis.hours_placeholder")}
                            style={{ minWidth: 160, maxWidth: 320 }}
                        />
                        <Button type="button" onClick={() => void savePraxisOeffnungszeiten()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisOeffnungszeiten(praxis.oeffnungszeiten ?? "");
                                setEditPraxisOeffnungszeiten(false);
                            }}
                        >
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : canEditPraxis ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setDraftPraxisOeffnungszeiten(praxis.oeffnungszeiten ?? "");
                            setEditPraxisOeffnungszeiten(true);
                        }}
                    >
                        {t("common.edit")}
                    </Button>
                ) : null}
            </div>
        </div>
        {canEditPraxis ? (
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <span className="settings-field-label">
                    <b>{t("settings.praxis.kv_label")}</b>
                    <span className="req" aria-hidden>
                        *
                    </span>
                </span>
                <div className="settings-row-muted">{(praxis.kv_nummer ?? "").trim() || "—"}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPraxisKv ? (
                    <>
                        <Input
                            value={draftPraxisKv}
                            onChange={(e) => setDraftPraxisKv(e.target.value)}
                            aria-label={t("settings.praxis.kv_label")}
                            style={{ minWidth: 160, maxWidth: 220 }}
                        />
                        <Button type="button" onClick={() => void savePraxisKv()}>{t("common.save")}</Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setDraftPraxisKv(praxis.kv_nummer ?? "");
                                setEditPraxisKv(false);
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
                            setDraftPraxisKv(praxis.kv_nummer ?? "");
                            setEditPraxisKv(true);
                        }}
                    >
                        {t("common.edit")}
                    </Button>
                )}
            </div>
        </div>
        ) : null}
        {canEditPraxis ? (
        <div className="settings-row" style={{ alignItems: "center" }}>
            <div>
                <b>{t("settings.praxis.logo")}</b>
                <div className="card-sub">{t("settings.praxis.logo_hint")}</div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {logoPreviewUrl ? (
                    <img src={logoPreviewUrl} alt="" style={{ height: 40, width: "auto", borderRadius: 8, border: "1px solid var(--line-strong)" }} />
                ) : null}
                <input id="praxis-logo-file" className="sr-only" type="file" accept="image/*" onChange={(e) => void onPraxisLogoFile(e)} />
                <Button type="button" variant="secondary" loading={logoBusy} disabled={logoBusy} onClick={() => document.getElementById("praxis-logo-file")?.click()}>
                    <span className="row" style={{ gap: 8, alignItems: "center" }}>
                        <UploadCircleIcon size={18} />
                        {t("settings.praxis.upload")}
                    </span>
                </Button>
            </div>
        </div>
        ) : null}
        {canEditPraxis ? (
        <>
        <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <b>{t("settings.praxis.contact_web_tax")}</b>
                <div className="settings-row-muted">{t("settings.praxis.contact_web_tax_hint")}</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                {editPraxisExtra ? (
                    <>
                        <Button type="button" onClick={() => void savePraxisExtra()}>{t("common.save")}</Button>
                        <Button type="button" variant="secondary" onClick={() => void cancelPraxisExtra()}>
                            {t("common.cancel")}
                        </Button>
                    </>
                ) : (
                    <Button type="button" variant="secondary" onClick={() => void startEditPraxisExtra()}>
                        {t("common.edit")}
                    </Button>
                )}
            </div>
        </div>
        {editPraxisExtra ? (
            <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                        id="px-tel"
                        label={t("common.phone")}
                        type="tel"
                        value={praxis.telefon ?? ""}
                        onChange={(e) => setPraxis((p) => ({ ...p, telefon: e.target.value }))}
                    />
                    <Input id="px-fax" label={t("settings.praxis.fax")} value={praxis.fax ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, fax: e.target.value }))} />
                    <Input
                        id="px-em"
                        label={t("common.email")}
                        type="email"
                        value={praxis.email ?? ""}
                        onChange={(e) => setPraxis((p) => ({ ...p, email: e.target.value }))}
                    />
                    <Input id="px-web" label={t("settings.praxis.website")} type="url" value={praxis.web ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, web: e.target.value }))} />
                    <Input id="px-ust" label={t("settings.praxis.vat_id")} value={praxis.ust_id ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, ust_id: e.target.value }))} />
                    <Input id="px-st" label={t("settings.praxis.tax_number")} value={praxis.steuernummer ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, steuernummer: e.target.value }))} />
                </div>
            </div>
        ) : null}
        <EinstellungenPraxisBillingSection
            praxis={praxis}
            editing={editPraxisBilling}
            onStartEdit={startEditPraxisBilling}
            onCancel={cancelPraxisBilling}
            onSave={savePraxisBilling}
            onChange={(patch) => setPraxis((p) => ({ ...p, ...patch }))}
        />
        </>
        ) : null}
        <button type="button" className="settings-row-clickable" onClick={() => onOpenArbeitsablaeufe()}>
            <div>
                <b>{t("settings.praxis.termine_calendar")}</b>
                <div className="settings-row-muted">{t("settings.praxis.termine_calendar_hint")}</div>
            </div>
            <span className="settings-chevron" aria-hidden>
                <ChevronRightIcon size={18} />
            </span>
        </button>
    </section>
        </>
    );
}

function PraxisAddressArea({
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
    onChange: (v: string) => void;
}) {
    const id = "praxis-addr";
    return (
        <label className="input-wrap" htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="input-label">{label}</span>
            <textarea
                id={id}
                className="input-edit settings-praxis-addr-ta"
                rows={5}
                autoComplete="street-address"
                spellCheck={false}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <p className="card-sub settings-praxis-field-hint" style={{ margin: 0 }}>
                {hint}
            </p>
        </label>
    );
}
