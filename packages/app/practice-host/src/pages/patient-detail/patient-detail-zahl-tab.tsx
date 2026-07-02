import { useT, useTParams } from "@/lib/i18n";
import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Behandlung, Untersuchung, Zahlung, ZahlungsArt } from "@/models/types";
import { itemValidationKey, type ValidationRecord } from "@/lib/akte-validation";
import { ShieldCheckIcon } from "@/lib/icons";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
    zahlungArtSelectOptions,
    ZAHL_EUR_EPS,
    formatZahlungBezugLine,
    roundMoney2,
    sumZahlungenForBehandlung,
    sumZahlungenForUntersuchung,
    zahlCountsTowardPaid,
    zahlHistoryForBehandlung,
    zahlHistoryForUntersuchung,
    zahlStatusDisplay,
    zahlungsartLabel,
    type ZahlZuordnungSummaryRow,
} from "@/lib/zahlung-buchung";
import { AkteEditFormOrInline, AkteInlineEditPanelShell, ConfirmOrInline } from "@/views/components/akte-confirm-presentation";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { Input, Select, Textarea } from "@/views/components/ui/input";

export type ZahlNewFormState = {
    linkKind: "" | "behand" | "unter";
    linkId: string;
    betrag: string;
    zahlungsart: ZahlungsArt;
    beschreibung: string;
};

export type ZahlEditFormState = {
    betrag: string;
    zahlungsart: ZahlungsArt;
    beschreibung: string;
};

export type PatientDetailZahlTabProps = {
    patientId: string | undefined;
    hasZahlData: boolean;
    zahlListenModus: "summe" | "historie";
    onZahlListenModusChange: (modus: "summe" | "historie") => void;
    canFinanzenWrite: boolean;
    canViewClinical: boolean;
    showZahlComposer: boolean;
    onOpenZahlComposer: () => void;
    onCloseZahlComposer: () => void;
    behandlungen: Behandlung[];
    untersuchungen: Untersuchung[];
    zahlungen: Zahlung[];
    zahlNewForm: ZahlNewFormState;
    setZahlNewForm: Dispatch<SetStateAction<ZahlNewFormState>>;
    zahlLinkSelectOptionsOpen: { value: string; label: string }[];
    zahlNeuMaxBetragEur: number | null;
    zahlZuordnungSummaries: ZahlZuordnungSummaryRow[];
    zahlungenHistorisch: Zahlung[];
    zahlEdit: Zahlung | null;
    zahlEditUnlocked: boolean;
    zahlEditForm: ZahlEditFormState;
    setZahlEditForm: Dispatch<SetStateAction<ZahlEditFormState>>;
    zahlEditMaxBetragEur: number | null;
    zahlDeleteId: string | null;
    itemValidation: Partial<Record<string, ValidationRecord>>;
    onPrintQuittung: (z: Zahlung) => void | Promise<void>;
    onPrintQuittungFromSummeRow: (row: ZahlZuordnungSummaryRow) => void;
    onSubmitSaveZahlNew: () => void | Promise<void>;
    onSaveZahlEdit: () => void | Promise<void>;
    onDeleteZahlung: () => void | Promise<void>;
    onCancelDeleteZahlung: () => void;
    onCloseZahlEdit: () => void;
    onUnlockZahlEdit: () => void;
    onStartEditZahlung: (z: Zahlung) => void;
    onRequestDeleteZahlung: (zahlungId: string) => void;
    onRequestValidateItem: (key: string, label: string) => void | Promise<void>;
    onRevokeItemValidation: (key: string, label: string) => void | Promise<void>;
    toast: (message: string, variant: "success" | "error" | "info") => void;
};

export function PatientDetailZahlTab({
    patientId: id,
    hasZahlData,
    zahlListenModus,
    onZahlListenModusChange,
    canFinanzenWrite,
    canViewClinical,
    showZahlComposer,
    onOpenZahlComposer,
    onCloseZahlComposer,
    behandlungen,
    untersuchungen,
    zahlungen,
    zahlNewForm,
    setZahlNewForm,
    zahlLinkSelectOptionsOpen,
    zahlNeuMaxBetragEur,
    zahlZuordnungSummaries,
    zahlungenHistorisch,
    zahlEdit,
    zahlEditUnlocked,
    zahlEditForm,
    setZahlEditForm,
    zahlEditMaxBetragEur,
    zahlDeleteId,
    itemValidation,
    onPrintQuittung: handlePrintQuittung,
    onPrintQuittungFromSummeRow: handlePrintQuittungFromSummeRow,
    onSubmitSaveZahlNew: submitSaveZahlNew,
    onSaveZahlEdit,
    onDeleteZahlung,
    onCancelDeleteZahlung,
    onCloseZahlEdit,
    onUnlockZahlEdit,
    onStartEditZahlung,
    onRequestDeleteZahlung,
    onRequestValidateItem: requestValidateItem,
    onRevokeItemValidation: revokeItemValidationRow,
    toast,
}: PatientDetailZahlTabProps) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const requireReleasedHint = tp("patient.detail.tab.zahl.release_required", {
        entity: t("patient.detail.tab.zahl.entity.behandlung"),
    });

    const renderZahlPaymentEditFields = (): ReactNode => {
        if (!zahlEdit || !canFinanzenWrite) return null;
        const z = zahlEdit;
        const pid = id ?? "";
        let bezug = emDash;
        if (z.behandlung_id) {
            const b = behandlungen.find((x) => x.id === z.behandlung_id);
            const bn = (b?.behandlungsnummer ?? "").trim();
            bezug = bn
                ? tp("patient.detail.tab.zahl.behand_ref", { number: bn })
                : t("patient.detail.tab.zahl.behand_ref_short");
        } else if (z.untersuchung_id) {
            const u = untersuchungen.find((x) => x.id === z.untersuchung_id);
            const un = (u?.untersuchungsnummer ?? "").trim();
            bezug = un
                ? tp("patient.detail.tab.zahl.unter_ref", { number: un })
                : t("patient.detail.tab.zahl.unter_ref_short");
        }
        const bRow = z.behandlung_id ? behandlungen.find((x) => x.id === z.behandlung_id) : undefined;
        const gesamtLive =
            bRow?.gesamtkosten != null && Number.isFinite(bRow.gesamtkosten)
                ? bRow.gesamtkosten
                : z.betrag_erwartet != null && Number.isFinite(z.betrag_erwartet)
                    ? z.betrag_erwartet
                    : null;
        let histBlock: ReactNode = null;
        let openAfter: number | null = null;
        if (z.behandlung_id && pid) {
            const hist = zahlHistoryForBehandlung(zahlungen, pid, z.behandlung_id);
            const otherPaid = zahlungen
                .filter(
                    (x) =>
                        x.patient_id === pid
                        && x.behandlung_id === z.behandlung_id
                        && x.id !== z.id
                        && zahlCountsTowardPaid(x.status),
                )
                .reduce((s, x) => s + x.betrag, 0);
            const cur = Number(String(zahlEditForm.betrag).replace(",", "."));
            const curOk = Number.isFinite(cur) && cur > 0 ? cur : 0;
            const totalPaid = otherPaid + curOk;
            openAfter = gesamtLive != null && gesamtLive > 0 ? Math.max(0, gesamtLive - totalPaid) : null;
            histBlock = (
                <div style={{ marginTop: 12 }}>
                    <div
                        style={{
                            fontSize: 11,
                            letterSpacing: "0.04em",
                            color: "var(--fg-3)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                        }}
                    >
                        {t("patient.detail.tab.zahl.history_same_line")}
                    </div>
                    {hist.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                            {hist.map((h) => {
                                const hs = zahlStatusDisplay(h.status, t);
                                return (
                                    <li key={h.id} style={{ opacity: h.id === z.id ? 1 : 0.85 }}>
                                        {formatDate(h.created_at)}
                                        {" · "}
                                        {h.betrag.toFixed(2)} €
                                        {" · "}
                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                        {h.id === z.id ? t("patient.detail.tab.zahl.this_booking") : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            );
        } else if (z.untersuchung_id && pid) {
            const histU = zahlHistoryForUntersuchung(zahlungen, pid, z.untersuchung_id);
            histBlock = (
                <div style={{ marginTop: 12 }}>
                    <div
                        style={{
                            fontSize: 11,
                            letterSpacing: "0.04em",
                            color: "var(--fg-3)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                        }}
                    >
                        {t("patient.detail.tab.zahl.history_title")}
                    </div>
                    {histU.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                            {histU.map((h) => {
                                const hs = zahlStatusDisplay(h.status, t);
                                return (
                                    <li key={h.id}>
                                        {formatDate(h.created_at)}
                                        {" · "}
                                        {h.betrag.toFixed(2)} €
                                        {" · "}
                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                        {h.id === z.id ? t("patient.detail.tab.zahl.this_booking") : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            );
        }
        return (
            <>
                <div
                    className="rounded-lg px-4 py-3"
                    style={{ border: "1px solid var(--line)", background: "var(--surface)", marginBottom: 12 }}
                >
                    <div style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--fg-3)", textTransform: "uppercase" }}>
                        {t("patient.detail.tab.zahl.assignment")}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{bezug}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginTop: 12, fontSize: 14 }}>
                        <div>
                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.cost_should")}</div>
                            <div style={{ fontWeight: 700 }}>
                                {gesamtLive != null ? formatCurrency(gesamtLive) : emDash}
                            </div>
                        </div>
                        {z.behandlung_id && openAfter != null ? (
                            <div>
                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.open_after_edit")}</div>
                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                            </div>
                        ) : null}
                    </div>
                    {histBlock}
                </div>
                <div>
                    <Input
                        id="zex-betrag"
                        type="number"
                        step="0.01"
                        min={0}
                        max={zahlEditMaxBetragEur != null ? zahlEditMaxBetragEur : undefined}
                        label={t("patient.detail.tab.zahl.amount_label")}
                        value={zahlEditForm.betrag}
                        disabled={!zahlEditUnlocked}
                        onChange={(e) => setZahlEditForm({ ...zahlEditForm, betrag: e.target.value })}
                        onBlur={(e) => {
                            if (zahlEditMaxBetragEur == null) return;
                            const n = Number(String(e.target.value).replace(",", "."));
                            if (!Number.isFinite(n) || n <= 0) return;
                            if (n > zahlEditMaxBetragEur + ZAHL_EUR_EPS) {
                                setZahlEditForm((p) => ({
                                    ...p,
                                    betrag: String(roundMoney2(zahlEditMaxBetragEur)),
                                }));
                                toast(
                                    tp("patient.detail.tab.zahl.amount_capped_edit", {
                                        amount: formatCurrency(zahlEditMaxBetragEur),
                                    }),
                                    "info",
                                );
                            }
                        }}
                    />
                    {zahlEditMaxBetragEur != null ? (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                            {tp("patient.detail.tab.zahl.max_hint_edit", { amount: formatCurrency(zahlEditMaxBetragEur) })}
                        </p>
                    ) : null}
                </div>
                <Select
                    id="zex-art"
                    label={t("patient.detail.tab.zahl.payment_method")}
                    value={zahlEditForm.zahlungsart}
                    disabled={!zahlEditUnlocked}
                    onChange={(e) => setZahlEditForm({ ...zahlEditForm, zahlungsart: e.target.value as ZahlungsArt })}
                    options={zahlungArtSelectOptions(t)}
                />
                <Textarea
                    id="zex-beschr"
                    label={t("common.description")}
                    rows={2}
                    value={zahlEditForm.beschreibung}
                    disabled={!zahlEditUnlocked}
                    onChange={(e) => setZahlEditForm({ ...zahlEditForm, beschreibung: e.target.value })}
                />
            </>
        );
    };

    const zahlEditPanelSubtitle = zahlEditUnlocked
        ? t("patient.detail.tab.zahl.edit_subtitle_unlocked")
        : t("patient.detail.tab.zahl.edit_subtitle_locked");

    const zahlEditPanelHeaderExtra =
        zahlEdit && !zahlEditUnlocked ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => onUnlockZahlEdit()}>
                {t("common.edit")}
            </Button>
        ) : null;

    const zahlEditPanelFooter =
        zahlEdit && canFinanzenWrite ? (
            <>
                <Button type="button" variant="ghost" onClick={onCloseZahlEdit}>
                    {t("common.cancel")}
                </Button>
                <Button
                    type="button"
                    disabled={
                        !zahlEditUnlocked
                        || zahlEditMaxBetragEur != null && zahlEditMaxBetragEur <= ZAHL_EUR_EPS
                    }
                    onClick={() => void onSaveZahlEdit()}
                >
                    {t("common.save")}
                </Button>
            </>
        ) : null;

    return (
        <div id="panel-zahl" role="tabpanel" aria-labelledby="tab-zahl">
            <Card className="card-pad">
                <CardHeader
                    title={t("patient.detail.tab.zahl.title")}
                    subtitle={
                        !hasZahlData
                            ? t("patient.detail.tab.zahl.subtitle_empty")
                            : zahlListenModus === "summe"
                                ? t("patient.detail.tab.zahl.subtitle_summe")
                                : t("patient.detail.tab.zahl.subtitle_historie")
                    }
                    action={(
                        <div className="row akte-zahl-toolbar" style={{ flexWrap: "wrap", alignItems: "center" }}>
                            <div className="akte-zahl-modus" role="tablist" aria-label={t("patient.detail.tab.zahl.view_billing_aria")}>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={zahlListenModus === "summe"}
                                    className={`akte-zahl-modus__btn${zahlListenModus === "summe" ? " is-active" : ""}`}
                                    onClick={() => onZahlListenModusChange("summe")}
                                >
                                    {t("patient.detail.tab.zahl.tab_payments")}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={zahlListenModus === "historie"}
                                    className={`akte-zahl-modus__btn${zahlListenModus === "historie" ? " is-active" : ""}`}
                                    onClick={() => onZahlListenModusChange("historie")}
                                >
                                    {t("patient.detail.tab.zahl.tab_historie")}
                                </button>
                            </div>
                            {canFinanzenWrite ? (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="akte-zahl-toolbar__cta"
                                    disabled={showZahlComposer}
                                    onClick={onOpenZahlComposer}
                                >
                                    {t("patient.detail.tab.zahl.new_cta")}
                                </Button>
                            ) : null}
                        </div>
                    )}
                />
                {canFinanzenWrite && showZahlComposer ? (
                    <div
                        id="ak-zahl-neu-panel"
                        className="akte-inline-panel"
                        style={{ marginBottom: 20 }}
                        role="region"
                        aria-label={t("patient.detail.tab.zahl.new_aria")}
                    >
                        <div className="akte-inline-panel-head">
                            <div>
                                <div className="akte-inline-panel-title">{t("patient.detail.tab.zahl.new_title")}</div>
                                <div className="akte-inline-panel-sub">
                                    {tp("patient.detail.tab.zahl.new_subtitle", { hint: requireReleasedHint })}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    onCloseZahlComposer();
                                }}
                            >
                                {t("common.close")}
                            </Button>
                        </div>
                        <div className="akte-inline-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {behandlungen.length + untersuchungen.length === 0 ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("patient.detail.tab.zahl.new_no_clinical")}
                                </p>
                            ) : zahlLinkSelectOptionsOpen.length <= 1 ? (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                    {t("patient.detail.tab.zahl.new_no_open")}
                                </p>
                            ) : null}
                            <Select
                                id="zahl-neu-link"
                                label={t("patient.detail.tab.zahl.assignment_label")}
                                value={
                                    zahlNewForm.linkKind && zahlNewForm.linkId
                                        ? `${zahlNewForm.linkKind}:${zahlNewForm.linkId}`
                                        : ""
                                }
                                options={zahlLinkSelectOptionsOpen}
                                disabled={zahlLinkSelectOptionsOpen.length <= 1}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (!v) {
                                        setZahlNewForm((p) => ({ ...p, linkKind: "", linkId: "" }));
                                        return;
                                    }
                                    const ci = v.indexOf(":");
                                    const kind = v.slice(0, ci) as "behand" | "unter";
                                    const rest = v.slice(ci + 1);
                                    setZahlNewForm((p) => ({ ...p, linkKind: kind, linkId: rest }));
                                }}
                            />
                            {zahlNewForm.linkKind && zahlNewForm.linkId && id ? (
                                (() => {
                                    const pid = id;
                                    if (zahlNewForm.linkKind === "behand") {
                                        const selBh = behandlungen.find((b) => b.id === zahlNewForm.linkId);
                                        const gesamt =
                                            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten)
                                                ? selBh.gesamtkosten
                                                : null;
                                        const hist = zahlHistoryForBehandlung(zahlungen, pid, zahlNewForm.linkId);
                                        const paidSum = sumZahlungenForBehandlung(zahlungen, pid, zahlNewForm.linkId);
                                        const openNow =
                                            gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum) : null;
                                        const betragN = Number(String(zahlNewForm.betrag).replace(",", "."));
                                        const add = Number.isFinite(betragN) && betragN > 0 ? betragN : 0;
                                        const openAfter =
                                            gesamt != null && gesamt > 0 ? Math.max(0, gesamt - paidSum - add) : null;
                                        const previewCase =
                                            gesamt != null && gesamt > 0 && openAfter != null
                                                ? openAfter <= 1e-6
                                                    ? "BEZAHLT"
                                                    : "TEILBEZAHLT"
                                                : "BEZAHLT";
                                        return (
                                            <>
                                                <div
                                                    className="rounded-lg px-4 py-3"
                                                    style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            letterSpacing: "0.04em",
                                                            color: "var(--fg-3)",
                                                            textTransform: "uppercase",
                                                            marginBottom: 10,
                                                        }}
                                                    >
                                                        {t("patient.detail.tab.zahl.cost_section_behand")}
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 14 }}>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.cost_should")}</div>
                                                            <div style={{ fontWeight: 700 }}>{gesamt != null ? formatCurrency(gesamt) : emDash}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.paid_already")}</div>
                                                            <div style={{ fontWeight: 600 }}>{formatCurrency(paidSum)}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.cost_open_now")}</div>
                                                            <div style={{ fontWeight: 700, color: openNow != null && openNow > 0 ? "var(--fg-1)" : "var(--fg-3)" }}>
                                                                {openNow != null ? formatCurrency(openNow) : emDash}
                                                            </div>
                                                        </div>
                                                        {add > 0 && openAfter != null ? (
                                                            <div>
                                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.cost_open_after_payment")}</div>
                                                                <div style={{ fontWeight: 600 }}>{formatCurrency(openAfter)}</div>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            letterSpacing: "0.04em",
                                                            color: "var(--fg-3)",
                                                            textTransform: "uppercase",
                                                            marginBottom: 6,
                                                        }}
                                                    >
                                                        {t("patient.detail.tab.zahl.history_for_line")}
                                                    </div>
                                                    {hist.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                            {hist.map((h) => {
                                                                const hs = zahlStatusDisplay(h.status, t);
                                                                return (
                                                                    <li key={h.id}>
                                                                        {formatDate(h.created_at)}
                                                                        {" · "}
                                                                        {h.betrag.toFixed(2)} €
                                                                        {" · "}
                                                                        <Badge variant={hs.variant}>{hs.label}</Badge>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                            {t("patient.detail.tab.zahl.history_empty_behand")}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                                    <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.case_after_save")}</span>
                                                    <Badge variant={previewCase === "BEZAHLT" ? "success" : previewCase === "TEILBEZAHLT" ? "warning" : "default"}>
                                                        {previewCase === "BEZAHLT"
                                                            ? t("patient.detail.tab.zahl.case_balanced")
                                                            : previewCase === "TEILBEZAHLT"
                                                                ? t("patient.detail.tab.zahl.case_still_open")
                                                                : previewCase}
                                                    </Badge>
                                                </div>
                                            </>
                                        );
                                    }
                                    const histU = zahlHistoryForUntersuchung(zahlungen, pid, zahlNewForm.linkId);
                                    const paidU = sumZahlungenForUntersuchung(zahlungen, pid, zahlNewForm.linkId);
                                    return (
                                        <>
                                            <div
                                                className="rounded-lg px-4 py-3"
                                                style={{ border: "1px solid var(--line)", background: "var(--surface)" }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        letterSpacing: "0.04em",
                                                        color: "var(--fg-3)",
                                                        textTransform: "uppercase",
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    {t("patient.detail.tab.zahl.unter_no_target")}
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 14 }}>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.cost_should")}</div>
                                                        <div style={{ fontWeight: 600 }}>{emDash}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{t("patient.detail.tab.zahl.paid_sum")}</div>
                                                        <div style={{ fontWeight: 600 }}>{formatCurrency(paidU)}</div>
                                                    </div>
                                                </div>
                                                <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                                    {t("patient.detail.tab.zahl.unter_target_hint")}
                                                </p>
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        letterSpacing: "0.04em",
                                                        color: "var(--fg-3)",
                                                        textTransform: "uppercase",
                                                        marginBottom: 6,
                                                    }}
                                                >
                                                    {t("patient.detail.tab.zahl.history_title")}
                                                </div>
                                                {histU.length > 0 ? (
                                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                        {histU.map((h) => {
                                                            const hs = zahlStatusDisplay(h.status, t);
                                                            return (
                                                                <li key={h.id}>
                                                                    {formatDate(h.created_at)}
                                                                    {" · "}
                                                                    {h.betrag.toFixed(2)} €
                                                                    {" · "}
                                                                    {hs.label}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                                                        {t("patient.detail.tab.zahl.history_empty_unter")}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()
                            ) : null}
                            <div>
                                <Input
                                    id="zahl-neu-betrag"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    max={zahlNeuMaxBetragEur != null ? zahlNeuMaxBetragEur : undefined}
                                    label={t("patient.detail.tab.zahl.payment_amount_label")}
                                    value={zahlNewForm.betrag}
                                    onChange={(e) => setZahlNewForm({ ...zahlNewForm, betrag: e.target.value })}
                                    onBlur={(e) => {
                                        if (zahlNeuMaxBetragEur == null) return;
                                        const n = Number(String(e.target.value).replace(",", "."));
                                        if (!Number.isFinite(n) || n <= 0) return;
                                        if (n > zahlNeuMaxBetragEur + ZAHL_EUR_EPS) {
                                            setZahlNewForm((p) => ({
                                                ...p,
                                                betrag: String(roundMoney2(zahlNeuMaxBetragEur)),
                                            }));
                                            toast(
                                                tp("patient.detail.tab.zahl.amount_capped_new", {
                                                    amount: formatCurrency(zahlNeuMaxBetragEur),
                                                }),
                                                "info",
                                            );
                                        }
                                    }}
                                />
                                {zahlNeuMaxBetragEur != null ? (
                                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                        {tp("patient.detail.tab.zahl.max_hint_new", { amount: formatCurrency(zahlNeuMaxBetragEur) })}
                                    </p>
                                ) : null}
                            </div>
                            <Select
                                id="zahl-neu-art"
                                label={t("patient.detail.tab.zahl.payment_method")}
                                value={zahlNewForm.zahlungsart}
                                onChange={(e) =>
                                    setZahlNewForm({ ...zahlNewForm, zahlungsart: e.target.value as ZahlungsArt })}
                                options={zahlungArtSelectOptions(t)}
                            />
                            <Textarea
                                id="zahl-neu-beschr"
                                label={t("common.description")}
                                rows={2}
                                value={zahlNewForm.beschreibung}
                                onChange={(e) => setZahlNewForm({ ...zahlNewForm, beschreibung: e.target.value })}
                            />
                        </div>
                        <div className="akte-inline-panel-actions" style={{ flexWrap: "wrap", gap: 10 }}>
                            {zahlNewForm.linkKind === "behand"
                            && zahlNeuMaxBetragEur != null
                            && zahlNeuMaxBetragEur <= ZAHL_EUR_EPS ? (
                                <span style={{ fontSize: 12, color: "var(--fg-3)", flex: "1 1 200px" }}>
                                    {t("patient.detail.tab.zahl.no_further_open")}
                                </span>
                            ) : null}
                            <Button type="button" variant="ghost" onClick={() => onCloseZahlComposer()}>
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    zahlNewForm.linkKind === "behand"
                                    && zahlNeuMaxBetragEur != null
                                    && zahlNeuMaxBetragEur <= ZAHL_EUR_EPS
                                }
                                onClick={() => void submitSaveZahlNew()}
                            >
                                {t("patient.detail.tab.zahl.save_payment")}
                            </Button>
                        </div>
                    </div>
                ) : null}
                {zahlungen.length === 0 ? (
                    <p style={{ color: "var(--fg-3)" }}>{t("patient.detail.zahl.empty")}</p>
                ) : zahlListenModus === "summe" ? (
                    zahlZuordnungSummaries.length === 0 ? (
                        <p style={{ color: "var(--fg-3)" }}>
                            {t("patient.detail.tab.zahl.no_summaries")}
                        </p>
                    ) : (
                        <table className="tbl tbl-zahl-akte">
                            <colgroup>
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "20%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "14%" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th scope="col">{t("patient.detail.tab.zahl.col.last_booking")}</th>
                                    <th scope="col">{t("patient.detail.tab.zahl.col.assignment")}</th>
                                    <th scope="col" className="zahl-th-num">{t("patient.detail.tab.zahl.col.should")}</th>
                                    <th scope="col" className="zahl-th-num">{t("patient.detail.tab.zahl.col.paid")}</th>
                                    <th scope="col" className="zahl-th-num">{t("patient.detail.tab.zahl.col.open")}</th>
                                    <th scope="col">{t("patient.detail.tab.zahl.col.status")}</th>
                                    <th scope="col">{t("patient.detail.tab.zahl.col.action")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {zahlZuordnungSummaries.map((row) => {
                                    const st = zahlStatusDisplay(row.status, t);
                                    return (
                                        <tr key={row.key}>
                                            <td>
                                                <div className="zahl-td-clip" title={formatDate(row.latestAt)}>
                                                    {formatDate(row.latestAt)}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="zahl-td-clip" title={row.bezugLine}>
                                                    {row.bezugLine}
                                                </div>
                                            </td>
                                            <td className="zahl-td-num">{row.soll != null ? formatCurrency(row.soll) : emDash}</td>
                                            <td className="zahl-td-num">{formatCurrency(row.gezahlt)}</td>
                                            <td className="zahl-td-num">
                                                {row.offen != null ? formatCurrency(row.offen) : emDash}
                                            </td>
                                            <td>
                                                <Badge variant={st.variant}>{st.label}</Badge>
                                            </td>
                                            <td className="zahl-td-actions">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handlePrintQuittungFromSummeRow(row)}
                                                >
                                                    {t("patient.detail.tab.zahl.receipt")}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )
                ) : (
                    <table className="tbl tbl-zahl-akte">
                        <colgroup>
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "37%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">{t("patient.detail.tab.zahl.col.date")}</th>
                                <th scope="col">{t("patient.detail.tab.zahl.col.reference")}</th>
                                <th scope="col">{t("patient.detail.tab.zahl.col.type")}</th>
                                <th scope="col">{t("patient.detail.tab.zahl.col.status")}</th>
                                <th scope="col" className="zahl-th-num">{t("patient.detail.tab.zahl.col.amount")}</th>
                                <th scope="col">{t("patient.detail.tab.zahl.col.action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zahlungenHistorisch.flatMap((z) => {
                                const st = zahlStatusDisplay(z.status, t);
                                const bezugLine = formatZahlungBezugLine(z, behandlungen, untersuchungen, t, tp);
                                let bezug = emDash;
                                if (z.behandlung_id) {
                                    const b = behandlungen.find((x) => x.id === z.behandlung_id);
                                    const bn = (b?.behandlungsnummer ?? "").trim();
                                    bezug = bn
                                        ? tp("patient.detail.tab.zahl.behand_short", { number: bn })
                                        : t("patient.detail.tab.zahl.behand_ref_short");
                                } else if (z.untersuchung_id) {
                                    const u = untersuchungen.find((x) => x.id === z.untersuchung_id);
                                    const un = (u?.untersuchungsnummer ?? "").trim();
                                    bezug = un
                                        ? tp("patient.detail.tab.zahl.unter_short", { number: un })
                                        : t("patient.detail.tab.zahl.unter_ref_short");
                                }
                                const dataRow = (
                                    <tr key={z.id}>
                                        <td>
                                            <div className="zahl-td-clip" title={formatDate(z.created_at)}>
                                                {formatDate(z.created_at)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="zahl-td-clip" title={bezugLine}>
                                                {bezug}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="zahl-td-clip" title={zahlungsartLabel(z.zahlungsart, t)}>
                                                {zahlungsartLabel(z.zahlungsart, t)}
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={st.variant}>{st.label}</Badge>
                                        </td>
                                        <td className="zahl-td-num">{z.betrag.toFixed(2)} €</td>
                                        <td className="zahl-td-actions">
                                            <div className="zahl-actions-inner">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handlePrintQuittung(z)}
                                                >
                                                    {t("patient.detail.tab.zahl.receipt")}
                                                </Button>
                                                {canViewClinical ? (
                                                    itemValidation[itemValidationKey("zahl", z.id)] ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                void revokeItemValidationRow(
                                                                    itemValidationKey("zahl", z.id),
                                                                    tp("patient.detail.tab.zahl.validate_label_amount", {
                                                                        amount: z.betrag.toFixed(2),
                                                                    }),
                                                                )}
                                                        >
                                                            {t("patient.detail.tab.zahl.revoke_validation")}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() =>
                                                                void requestValidateItem(
                                                                    itemValidationKey("zahl", z.id),
                                                                    tp("patient.detail.tab.zahl.validate_label_dated", {
                                                                        date: formatDate(z.created_at),
                                                                        amount: z.betrag.toFixed(2),
                                                                    }),
                                                                )}
                                                        >
                                                            <ShieldCheckIcon />{t("patient.detail.tab.zahl.validate")}
                                                        </Button>
                                                    )
                                                ) : null}
                                                {canFinanzenWrite ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            disabled={z.status !== "AUSSTEHEND" && z.status !== "TEILBEZAHLT"}
                                                            onClick={() => onStartEditZahlung(z)}
                                                        >
                                                            {t("common.edit")}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            disabled={z.status !== "AUSSTEHEND" && z.status !== "TEILBEZAHLT"}
                                                            onClick={() => onRequestDeleteZahlung(z.id)}
                                                        >
                                                            {t("common.delete")}
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                );
                                if (canFinanzenWrite && zahlListenModus === "historie" && zahlEdit?.id === z.id) {
                                    return [
                                        <tr key={`${z.id}__edit`} className="zahl-historie-edit-row">
                                            <td colSpan={6} className="zahl-historie-edit-cell">
                                                <AkteInlineEditPanelShell
                                                    id="ak-zahl-edit-panel-row"
                                                    ariaLabel={t("patient.detail.tab.zahl.edit_aria")}
                                                    title={t("patient.detail.tab.zahl.edit_title")}
                                                    subtitle={zahlEditPanelSubtitle}
                                                    headerExtra={zahlEditPanelHeaderExtra}
                                                    onClose={onCloseZahlEdit}
                                                    footer={zahlEditPanelFooter}
                                                    rootClassName="akte-inline-panel--zahl-table-edit"
                                                >
                                                    {renderZahlPaymentEditFields()}
                                                </AkteInlineEditPanelShell>
                                            </td>
                                        </tr>,
                                        dataRow,
                                    ];
                                }
                                return [dataRow];
                            })}
                        </tbody>
                    </table>
                )}
                {canFinanzenWrite && zahlDeleteId ? (
                    <ConfirmOrInline
                        area="patient_akte_zahlung_delete"
                        open={canFinanzenWrite && !!zahlDeleteId}
                        inlineId="ak-zahl-delete-panel"
                        title={t("patient.detail.zahl.delete_title")}
                        message={(() => {
                            const z = zahlungen.find((x) => x.id === zahlDeleteId);
                            return z
                                ? tp("patient.detail.tab.zahl.delete_message", {
                                      amount: z.betrag.toFixed(2),
                                      method: z.zahlungsart,
                                      status: z.status,
                                  })
                                : t("patient.detail.tab.zahl.delete_message_generic");
                        })()}
                        onCancel={onCancelDeleteZahlung}
                        onConfirm={() => void onDeleteZahlung()}
                        confirmLabel={t("common.yes_delete")}
                        danger
                    />
                ) : null}
                {canFinanzenWrite && zahlEdit && zahlListenModus !== "historie" ? (
                    <AkteEditFormOrInline
                        area="patient_akte_zahlung_edit"
                        open={canFinanzenWrite && !!zahlEdit}
                        onClose={onCloseZahlEdit}
                        title={t("patient.detail.tab.zahl.edit_title")}
                        subtitle={zahlEditPanelSubtitle}
                        inlineId="ak-zahl-edit-panel"
                        ariaLabel={t("patient.detail.tab.zahl.edit_aria")}
                        headerExtra={zahlEditPanelHeaderExtra}
                        footer={zahlEditPanelFooter}
                    >
                        {renderZahlPaymentEditFields()}
                    </AkteEditFormOrInline>
                ) : null}
            </Card>
        </div>
    );
}
