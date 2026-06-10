import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { BestellStatus, Bestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import type { Zahlung } from "@/models/types";
import type { FinanzTxRow } from "@/lib/report-export";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExportIcon, PackageIcon, UsersIcon, XIcon } from "@/lib/icons";
import { Select } from "./ui/input";

const BESTELL_STATUS_OPTIONS: readonly { value: BestellStatus; label: string }[] = [
    { value: "OFFEN", label: "Offen" },
    { value: "UNTERWEGS", label: "Unterwegs" },
    { value: "GELIEFERT", label: "Geliefert" },
    { value: "STORNIERT", label: "Storniert" },
];

function pillClass(variant: "success" | "warning" | "default"): string {
    if (variant === "success") return "pill green";
    if (variant === "warning") return "pill orange";
    return "pill grey";
}

function zahlStatusDisplay(status: string): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    if (s === "BEZAHLT") return { variant: "success", label: "Bezahlt" };
    if (s === "TEILBEZAHLT") return { variant: "warning", label: "Teilbezahlt" };
    if (s === "AUSSTEHEND") return { variant: "warning", label: "Ausstehend" };
    if (s === "STORNIERT") return { variant: "default", label: "Storniert" };
    return { variant: "default", label: s || "—" };
}

function bestellStatusDe(s: string): { variant: "success" | "warning" | "default"; label: string } {
    if (s === "GELIEFERT") return { variant: "success", label: "Geliefert" };
    if (s === "UNTERWEGS") return { variant: "warning", label: "Unterwegs" };
    if (s === "OFFEN") return { variant: "warning", label: "Offen" };
    if (s === "STORNIERT") return { variant: "default", label: "Storniert" };
    return { variant: "default", label: s };
}

function zahlungsartLabel(art: string): string {
    const map: Record<string, string> = {
        BAR: "Bar",
        KARTE: "Karte",
        UEBERWEISUNG: "Überweisung",
        RECHNUNG: "Rechnung",
    };
    return map[art] ?? art;
}

function bezugKurz(z: Zahlung): string {
    if (z.behandlung_id) return "Behandlung";
    if (z.untersuchung_id) return "Untersuchung";
    return "Direktzahlung";
}

function vorgangText(z: Zahlung): string {
    const b = bezugKurz(z);
    const note = (z.beschreibung ?? "").trim();
    if (note) return b === "Direktzahlung" ? note : `${b} — ${note}`;
    return b;
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
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

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
                const st = bestellStatusDe(b.status);
                const bBetragEur = b.gesamtbetrag;
                const hasBetrag = bBetragEur != null && Number.isFinite(bBetragEur);
                const amtLabel = hasBetrag ? `−${formatCurrency(bBetragEur)}` : "− offen";
                return (
                    <>
                        <div className="termin-drawer-head">
                            <span className={pillClass(st.variant)}>{st.label}</span>
                            <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="termin-drawer-section">
                            <div className="termin-drawer-eyebrow">Bestellung</div>
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
                                <div className="termin-drawer-eyebrow">Datum</div>
                                <div className="termin-drawer-meta-val">
                                    {format(parseISO(b.created_at), "d. MMM yyyy", { locale: de })}
                                </div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">Betrag</div>
                                <div className="termin-drawer-meta-val">{amtLabel}</div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">Menge</div>
                                <div className="termin-drawer-meta-val">
                                    {b.menge != null ? `${b.menge}${b.einheit ? ` ${b.einheit}` : ""}` : "—"}
                                </div>
                            </div>
                        </div>
                        <div className="ios-list">
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">Lieferant</div>
                                <div className="termin-drawer-meta-val">{b.lieferant}</div>
                            </div>
                            {b.pharmaberater ? (
                                <div className="ios-row">
                                    <div className="termin-drawer-eyebrow">Kontakt</div>
                                    <div className="termin-drawer-meta-val">{b.pharmaberater}</div>
                                </div>
                            ) : null}
                            {b.erwartet_am ? (
                                <div className="ios-row">
                                    <div className="termin-drawer-eyebrow">Erwartet</div>
                                    <div className="termin-drawer-meta-val">{formatDate(b.erwartet_am)}</div>
                                </div>
                            ) : null}
                        </div>
                        <div className="termin-drawer-actions row">
                            <button type="button" className="btn btn-subtle" onClick={() => onOpenBestellung(b.id)}>
                                <PackageIcon size={14} />
                                Bestellung
                            </button>
                        </div>
                        {canUpdateBestellStatus ? (
                            <div className="termin-drawer-panel-foot">
                                <div className="termin-drawer-section">
                                    <div className="termin-drawer-eyebrow">Status ändern</div>
                                    <Select
                                        id={`fin-drawer-best-status-${b.id}`}
                                        className="finanzen-zahl-status-select w-full min-w-0"
                                        aria-label={`Bestellstatus: ${b.artikel}`}
                                        value={b.status}
                                        disabled={statusUpdatingBestellId === b.id}
                                        onChange={(e) =>
                                            onBestellStatusChange?.(b, e.target.value as BestellStatus)
                                        }
                                        options={BESTELL_STATUS_OPTIONS.map((o) => ({
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
                const st = zahlStatusDisplay(z.status);
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
                            <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
                                <XIcon size={18} />
                            </button>
                        </div>
                        <div className="termin-drawer-section">
                            <div className="termin-drawer-eyebrow">Zahlung</div>
                            <h2 id={titleId} className="termin-drawer-title">
                                {vorgangText(z)}
                            </h2>
                            <div className="termin-drawer-sub">
                                {patientName} · {zahlungsartLabel(z.zahlungsart)}
                            </div>
                        </div>
                        <div className="termin-drawer-meta-row">
                            <div>
                                <div className="termin-drawer-eyebrow">Datum</div>
                                <div className="termin-drawer-meta-val">
                                    {format(parseISO(z.created_at), "d. MMM yyyy", { locale: de })}
                                </div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">Betrag</div>
                                <div className="termin-drawer-meta-val">{zahlungAmt}</div>
                            </div>
                            <div>
                                <div className="termin-drawer-eyebrow">Art</div>
                                <div className="termin-drawer-meta-val">{zahlungsartLabel(z.zahlungsart)}</div>
                            </div>
                        </div>
                        <div className="ios-list">
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">Patient</div>
                                <div className="termin-drawer-meta-val">{patientName}</div>
                            </div>
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">Bezug</div>
                                <div className="termin-drawer-meta-val">{bezugKurz(z)}</div>
                            </div>
                            {(z.beschreibung ?? "").trim() ? (
                                <div className="ios-row">
                                    <div className="termin-drawer-eyebrow">Beschreibung</div>
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
                                    Quittung
                                </button>
                            ) : null}
                            <button type="button" className="btn btn-subtle" onClick={() => onOpenAkte(z.patient_id)}>
                                <UsersIcon size={14} />
                                Akte
                            </button>
                        </div>
                    </>
                );
            })()
        );

    return createPortal(
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label="Schließen" onClick={onClose} />
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
