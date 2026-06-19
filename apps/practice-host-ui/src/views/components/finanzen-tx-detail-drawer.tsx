import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import type { BestellStatus, Bestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import type { Zahlung } from "@/models/types";
import type { FinanzTxRow } from "@/lib/report-export";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
    bestellStatusDisplay,
    bestellStatusOptions,
    bezugKurz,
    vorgangText,
    zahlStatusDisplay,
    zahlungsartLabel,
} from "@/lib/finance-order-labels";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import { ExportIcon, PackageIcon, UsersIcon, XIcon } from "@/lib/icons";
import { Select } from "./ui/input";

function pillClass(variant: "success" | "warning" | "default"): string {
    if (variant === "success") return "pill green";
    if (variant === "warning") return "pill orange";
    return "pill grey";
}

export function finanzenTxRowKey(row: FinanzTxRow): string {
    return row.kind === "zahlung" ? `z-${row.z.id}` : `b-${row.b.id}`;
}

export type FinanzenTxDetailDrawerProps = {
    row: FinanzTxRow;
    patientName: string;
    onClose: () => void;
    onOpenBestellung: (id: string) => void;
    onOpenAkte: (patientId: string) => void;
    onQuittungExport?: (z: Zahlung) => void;
    onBestellStatusChange?: (b: Bestellung, status: BestellStatus) => void;
    canUpdateBestellStatus?: boolean;
    canExportQuittung?: boolean;
    quittungBusy?: boolean;
    statusUpdatingBestellId?: string | null;
};

export function FinanzenTxDetailDrawer({
    row,
    patientName,
    onClose,
    onOpenBestellung,
    onOpenAkte,
    onQuittungExport,
    onBestellStatusChange,
    canUpdateBestellStatus = false,
    canExportQuittung = false,
    quittungBusy = false,
    statusUpdatingBestellId = null,
}: FinanzenTxDetailDrawerProps) {
    const t = useT();
    const dateFnsLocale = useDateFnsLocale();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const bestellStatusSelectOptions = useMemo(() => bestellStatusOptions(t), [t]);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            panelRef.current?.querySelector<HTMLButtonElement>(".termin-drawer-head .icon-btn")?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const layer =
        row.kind === "bestellung" ? (
            (() => {
                const b = row.b;
                const st = bestellStatusDisplay(b.status, t);
                const bBetragEur = b.gesamtbetrag;
                const hasBetrag = bBetragEur != null && Number.isFinite(bBetragEur);
                const amtLabel = hasBetrag ? `−${formatCurrency(bBetragEur)}` : t("drawer.finanzen_tx.amount_open");
                return (
                    <>
                        <div className="termin-drawer-head">
                            <span className={pillClass(st.variant)}>{st.label}</span>
                            <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="termin-drawer-section">
                            <div className="termin-drawer-eyebrow">{t("drawer.finanzen_tx.eyebrow_bestellung")}</div>
                            <h2 id={titleId} className="termin-drawer-title">
                                {b.artikel}
                            </h2>
                            <div className="termin-drawer-sub">
                                {b.lieferant}
                                {b.bestellnummer ? ` · ${b.bestellnummer}` : ""}
                            </div>
                        </div>
                        <div className="termin-drawer-meta-row">
                            <div>
                                <div className="termin-drawer-eyebrow">{t("common.date")}</div>
                                <div className="termin-drawer-meta-val">
                                    {format(parseISO(b.created_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                                </div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">{t("common.amount")}</div>
                                <div className="termin-drawer-meta-val">{amtLabel}</div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">{t("common.quantity")}</div>
                                <div className="termin-drawer-meta-val">
                                    {b.menge != null ? `${b.menge}${b.einheit ? ` ${b.einheit}` : ""}` : "—"}
                                </div>
                            </div>
                        </div>
                        <div className="ios-list">
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">{t("common.supplier")}</div>
                                <div className="termin-drawer-meta-val">{b.lieferant}</div>
                            </div>
                            {b.pharmaberater ? (
                                <div className="ios-row">
                                    <div className="termin-drawer-eyebrow">{t("common.contact")}</div>
                                    <div className="termin-drawer-meta-val">{b.pharmaberater}</div>
                                </div>
                            ) : null}
                            {b.erwartet_am ? (
                                <div className="ios-row">
                                    <div className="termin-drawer-eyebrow">{t("common.expected")}</div>
                                    <div className="termin-drawer-meta-val">{formatDate(b.erwartet_am)}</div>
                                </div>
                            ) : null}
                        </div>
                        <div className="termin-drawer-actions row">
                            <button type="button" className="btn btn-subtle" onClick={() => onOpenBestellung(b.id)}>
                                <PackageIcon size={14} />
                                {t("drawer.finanzen_tx.btn_bestellung")}
                            </button>
                        </div>
                        {canUpdateBestellStatus ? (
                            <div className="termin-drawer-panel-foot">
                                <div className="termin-drawer-section">
                                    <div className="termin-drawer-eyebrow">{t("drawer.finanzen_tx.change_status")}</div>
                                    <Select
                                        id={`fin-drawer-best-status-${b.id}`}
                                        className="finanzen-zahl-status-select w-full min-w-0"
                                        aria-label={`${t("common.status")}: ${b.artikel}`}
                                        value={b.status}
                                        disabled={statusUpdatingBestellId === b.id}
                                        onChange={(e) =>
                                            onBestellStatusChange?.(b, e.target.value as BestellStatus)
                                        }
                                        options={bestellStatusSelectOptions.map((o) => ({
                                            value: o.value,
                                            label: o.label,
                                        }))}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </>
                );
            })()
        ) : (
            (() => {
                const z = row.z;
                const st = zahlStatusDisplay(z.status, t);
                const cur = formatCurrency(Math.abs(z.betrag));
                const zahlungAmt =
                    z.status === "STORNIERT"
                        ? `−${cur}`
                        : z.status === "BEZAHLT" || z.status === "TEILBEZAHLT"
                          ? `+${cur}`
                          : `+${cur}`;
                const showQuittung =
                    canExportQuittung && (z.status === "BEZAHLT" || z.status === "TEILBEZAHLT");
                return (
                    <>
                        <div className="termin-drawer-head">
                            <span className={pillClass(st.variant)}>{st.label}</span>
                            <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="termin-drawer-section">
                            <div className="termin-drawer-eyebrow">{t("drawer.finanzen_tx.eyebrow_zahlung")}</div>
                            <h2 id={titleId} className="termin-drawer-title">
                                {vorgangText(z, t)}
                            </h2>
                            <div className="termin-drawer-sub">
                                {patientName} · {zahlungsartLabel(z.zahlungsart, t)}
                            </div>
                        </div>
                        <div className="termin-drawer-meta-row">
                            <div>
                                <div className="termin-drawer-eyebrow">{t("common.date")}</div>
                                <div className="termin-drawer-meta-val">
                                    {format(parseISO(z.created_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                                </div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">{t("common.amount")}</div>
                                <div className="termin-drawer-meta-val">{zahlungAmt}</div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">{t("drawer.finanzen_tx.kind_art")}</div>
                                <div className="termin-drawer-meta-val">{zahlungsartLabel(z.zahlungsart, t)}</div>
                            </div>
                        </div>
                        <div className="ios-list">
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">{t("common.patient")}</div>
                                <div className="termin-drawer-meta-val">{patientName}</div>
                            </div>
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">{t("common.reference")}</div>
                                <div className="termin-drawer-meta-val">{bezugKurz(z, t)}</div>
                            </div>
                            {(z.beschreibung ?? "").trim() ? (
                                <div className="ios-row">
                                    <div className="termin-drawer-eyebrow">{t("common.description")}</div>
                                    <div className="termin-drawer-meta-val">{z.beschreibung}</div>
                                </div>
                            ) : null}
                        </div>
                        <div className="termin-drawer-actions row">
                            {showQuittung ? (
                                <button
                                    type="button"
                                    className="btn btn-subtle"
                                    disabled={quittungBusy}
                                    onClick={() => onQuittungExport?.(z)}
                                >
                                    <ExportIcon size={14} />
                                    {t("drawer.finanzen_tx.btn_quittung")}
                                </button>
                            ) : null}
                            <button type="button" className="btn btn-subtle" onClick={() => onOpenAkte(z.patient_id)}>
                                <UsersIcon size={14} />
                                {t("drawer.finanzen_tx.btn_akte")}
                            </button>
                        </div>
                    </>
                );
            })()
        );

    return createPortal(
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label={t("common.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="termin-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="termin-drawer-body-scroll">{layer}</div>
            </div>
        </div>,
        document.body,
    );
}
