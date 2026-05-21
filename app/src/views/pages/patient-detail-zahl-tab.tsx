import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Behandlung, Untersuchung, Zahlung, ZahlungsArt } from "@/models/types";
import { itemValidationKey, type ValidationRecord } from "@/lib/akte-validation";
import { ShieldCheckIcon } from "@/lib/icons";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
    ZAHLUNG_ART_SELECT,
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

const renderZahlPaymentEditFields = (): ReactNode => {
    if (!zahlEdit || !canFinanzenWrite) return null;
    const z = zahlEdit;
    const pid = id ?? "";
    let bezug = "—";
    if (z.behandlung_id) {
        const b = behandlungen.find((x) => x.id === z.behandlung_id);
        const bn = (b?.behandlungsnummer ?? "").trim();
        bezug = bn ? `Behandlung B ${bn}` : "Behandlung";
    } else if (z.untersuchung_id) {
        const u = untersuchungen.find((x) => x.id === z.untersuchung_id);
        const un = (u?.untersuchungsnummer ?? "").trim();
        bezug = un ? `Untersuchung U ${un}` : "Untersuchung";
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
                    Zahlungsverlauf (dieselbe Zeile)
                </div>
                {hist.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                        {hist.map((h) => {
                            const hs = zahlStatusDisplay(h.status);
                            return (
                                <li key={h.id} style={{ opacity: h.id === z.id ? 1 : 0.85 }}>
                                    {formatDate(h.created_at)}
                                    {" · "}
                                    {h.betrag.toFixed(2)} €
                                    {" · "}
                                    <Badge variant={hs.variant}>{hs.label}</Badge>
                                    {h.id === z.id ? " (diese Buchung)" : null}
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
                    Zahlungsverlauf
                </div>
                {histU.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                        {histU.map((h) => {
                            const hs = zahlStatusDisplay(h.status);
                            return (
                                <li key={h.id}>
                                    {formatDate(h.created_at)}
                                    {" · "}
                                    {h.betrag.toFixed(2)} €
                                    {" · "}
                                    <Badge variant={hs.variant}>{hs.label}</Badge>
                                    {h.id === z.id ? " (diese Buchung)" : null}
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
                    Zuordnung
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{bezug}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginTop: 12, fontSize: 14 }}>
                    <div>
                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Kosten (Soll)</div>
                        <div style={{ fontWeight: 700 }}>
                            {gesamtLive != null ? formatCurrency(gesamtLive) : "—"}
                        </div>
                    </div>
                    {z.behandlung_id && openAfter != null ? (
                        <div>
                            <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Offen nach diesem Betrag</div>
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
                    label="Betrag (€) *"
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
                                `Betrag auf maximal ${formatCurrency(zahlEditMaxBetragEur)} begrenzt.`,
                                "info",
                            );
                        }
                    }}
                />
                {zahlEditMaxBetragEur != null ? (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                        Höchstens {formatCurrency(zahlEditMaxBetragEur)} für diese Buchung (Kosten minus andere Zahlungen derselben Behandlung).
                    </p>
                ) : null}
            </div>
            <Select
                id="zex-art"
                label="Zahlungsart"
                value={zahlEditForm.zahlungsart}
                disabled={!zahlEditUnlocked}
                onChange={(e) => setZahlEditForm({ ...zahlEditForm, zahlungsart: e.target.value as ZahlungsArt })}
                options={[...ZAHLUNG_ART_SELECT]}
            />
            <Textarea
                id="zex-beschr"
                label="Beschreibung"
                rows={2}
                value={zahlEditForm.beschreibung}
                disabled={!zahlEditUnlocked}
                onChange={(e) => setZahlEditForm({ ...zahlEditForm, beschreibung: e.target.value })}
            />
        </>
    );
};

const zahlEditPanelSubtitle =
    zahlEditUnlocked
        ? "Nur für Zahlungen mit Status ausstehend oder teilbezahlt. Bei geändertem Betrag wird der Status automatisch neu gesetzt."
        : "Ansicht — Felder sind gesperrt. „Bearbeiten“ wählen zum Ändern.";

const zahlEditPanelHeaderExtra =
    zahlEdit && !zahlEditUnlocked ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => onUnlockZahlEdit()}>
            Bearbeiten
        </Button>
    ) : null;

const zahlEditPanelFooter =
    zahlEdit && canFinanzenWrite ? (
        <>
            <Button type="button" variant="ghost" onClick={onCloseZahlEdit}>
                Abbrechen
            </Button>
            <Button
                type="button"
                disabled={
                    !zahlEditUnlocked
                    || zahlEditMaxBetragEur != null && zahlEditMaxBetragEur <= ZAHL_EUR_EPS
                }
                onClick={() => void onSaveZahlEdit()}
            >
                Speichern
            </Button>
        </>
    ) : null;

    return (
    <div id="panel-zahl" role="tabpanel" aria-labelledby="tab-zahl">
    <Card className="card-pad">
        <CardHeader
            title="Kundenleistungen & Abrechnung"
            subtitle={
                !hasZahlData
                    ? "Noch keine Zahlungen — bei neuer Behandlung oder Untersuchung wird eine offene Abrechnungszeile angelegt."
                    : zahlListenModus === "summe"
                        ? "„Zahlungen“: eine Zeile pro B-/U-Zuordnung mit aktuellem Stand (Summen). „Historie“: jede Buchung in zeitlicher Reihenfolge."
                        : "Chronologische Buchungen wie in der Finanzliste — für Prüfung und Änderungen pro Eintrag nutzen Sie die Aktions-Spalte."
            }
            action={(
                <div className="row akte-zahl-toolbar" style={{ flexWrap: "wrap", alignItems: "center" }}>
                    <div className="akte-zahl-modus" role="tablist" aria-label="Ansicht Abrechnung">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={zahlListenModus === "summe"}
                            className={`akte-zahl-modus__btn${zahlListenModus === "summe" ? " is-active" : ""}`}
                            onClick={() => onZahlListenModusChange("summe")}
                        >
                            Zahlungen
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={zahlListenModus === "historie"}
                            className={`akte-zahl-modus__btn${zahlListenModus === "historie" ? " is-active" : ""}`}
                            onClick={() => onZahlListenModusChange("historie")}
                        >
                            Historie
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
                            + Neue Zahlung
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
                aria-label="Neue Zahlung"
            >
                <div className="akte-inline-panel-head">
                    <div>
                        <div className="akte-inline-panel-title">Neue Zahlung</div>
                        <div className="akte-inline-panel-sub">
                            Zuordnung nur zu noch offenen B-/U-Zeilen (Bei gesetztem Behandlungssoll ohne Rest wird die Zeile ausgeblendet). Erwartete Kosten sind bei der Behandlung hinterlegt.
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
                        Schließen
                    </Button>
                </div>
                <div className="akte-inline-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {behandlungen.length + untersuchungen.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                            Es sind noch keine Behandlungen oder Untersuchungen in dieser Akte — bitte zuerst klinische Einträge anlegen, dann die Zahlung zuordnen.
                        </p>
                    ) : zahlLinkSelectOptionsOpen.length <= 1 ? (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>
                            Keine offene Zuordnung: alle Behandlungssollen sind ausgeglichen oder es fehlen klinische Einträge. Über „Historie“ sehen Sie vergangene Buchungen.
                        </p>
                    ) : null}
                    <Select
                        id="zahl-neu-link"
                        label="Zuordnung (nur offene Zeilen)"
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
                                                Kosten & offener Betrag (Behandlung)
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 14 }}>
                                                <div>
                                                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Kosten (Soll)</div>
                                                    <div style={{ fontWeight: 700 }}>{gesamt != null ? formatCurrency(gesamt) : "—"}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Bereits gezahlt</div>
                                                    <div style={{ fontWeight: 600 }}>{formatCurrency(paidSum)}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Offen jetzt</div>
                                                    <div style={{ fontWeight: 700, color: openNow != null && openNow > 0 ? "var(--fg-1)" : "var(--fg-3)" }}>
                                                        {openNow != null ? formatCurrency(openNow) : "—"}
                                                    </div>
                                                </div>
                                                {add > 0 && openAfter != null ? (
                                                    <div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Nach dieser Zahlung offen</div>
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
                                                Zahlungsverlauf zu dieser Zeile
                                            </div>
                                            {hist.length > 0 ? (
                                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                    {hist.map((h) => {
                                                        const hs = zahlStatusDisplay(h.status);
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
                                                    Noch keine Buchung zu dieser Behandlungszeile.
                                                </p>
                                            )}
                                        </div>
                                        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                            <span style={{ fontSize: 13, color: "var(--fg-3)" }}>Fall nach Speichern (Soll vs. Summe):</span>
                                            <Badge variant={previewCase === "BEZAHLT" ? "success" : previewCase === "TEILBEZAHLT" ? "warning" : "default"}>
                                                {previewCase === "BEZAHLT" ? "Ausgeglichen" : previewCase === "TEILBEZAHLT" ? "Noch offen" : previewCase}
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
                                            Untersuchung (ohne Sollkosten)
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ fontSize: 14 }}>
                                            <div>
                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Kosten (Soll)</div>
                                                <div style={{ fontWeight: 600 }}>—</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Bereits gezahlt (Summe)</div>
                                                <div style={{ fontWeight: 600 }}>{formatCurrency(paidU)}</div>
                                            </div>
                                        </div>
                                        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                            Einzelbuchungen werden ohne Restbetrag gegen ein Soll geführt; der Verlauf zeigt alle Zahlungen zu dieser Untersuchung.
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
                                            Zahlungsverlauf
                                        </div>
                                        {histU.length > 0 ? (
                                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                                {histU.map((h) => {
                                                    const hs = zahlStatusDisplay(h.status);
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
                                                Noch keine Zahlung zu dieser Untersuchung.
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
                            label="Zahlbetrag (€) *"
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
                                        `Betrag auf maximal ${formatCurrency(zahlNeuMaxBetragEur)} begrenzt (offener Betrag).`,
                                        "info",
                                    );
                                }
                            }}
                        />
                        {zahlNeuMaxBetragEur != null ? (
                            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
                                Höchstens {formatCurrency(zahlNeuMaxBetragEur)} (aktuell offen für diese Behandlung).
                            </p>
                        ) : null}
                    </div>
                    <Select
                        id="zahl-neu-art"
                        label="Zahlungsart"
                        value={zahlNewForm.zahlungsart}
                        onChange={(e) =>
                            setZahlNewForm({ ...zahlNewForm, zahlungsart: e.target.value as ZahlungsArt })}
                        options={[...ZAHLUNG_ART_SELECT]}
                    />
                    <Textarea
                        id="zahl-neu-beschr"
                        label="Beschreibung"
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
                            Für diese Behandlung ist kein weiterer Betrag offen (Soll bereits gedeckt).
                        </span>
                    ) : null}
                    <Button type="button" variant="ghost" onClick={() => onCloseZahlComposer()}>
                        Abbrechen
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
                        Zahlung speichern
                    </Button>
                </div>
            </div>
        ) : null}
        {zahlungen.length === 0 ? (
            <p style={{ color: "var(--fg-3)" }}>Keine Zahlungen vorhanden.</p>
        ) : zahlListenModus === "summe" ? (
            zahlZuordnungSummaries.length === 0 ? (
                <p style={{ color: "var(--fg-3)" }}>
                    Keine zusammenfassbaren Zuordnungen vorhanden.
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
                            <th scope="col">Letzte Buchung</th>
                            <th scope="col">Zuordnung</th>
                            <th scope="col" className="zahl-th-num">Soll</th>
                            <th scope="col" className="zahl-th-num">Gezahlt</th>
                            <th scope="col" className="zahl-th-num">Offen</th>
                            <th scope="col">Status</th>
                            <th scope="col">Aktion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zahlZuordnungSummaries.map((row) => {
                            const st = zahlStatusDisplay(row.status);
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
                                    <td className="zahl-td-num">{row.soll != null ? formatCurrency(row.soll) : "—"}</td>
                                    <td className="zahl-td-num">{formatCurrency(row.gezahlt)}</td>
                                    <td className="zahl-td-num">
                                        {row.offen != null ? formatCurrency(row.offen) : "—"}
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
                                            Quittung
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
                        <th scope="col">Datum</th>
                        <th scope="col">Bezug</th>
                        <th scope="col">Art</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="zahl-th-num">Betrag</th>
                        <th scope="col">Aktion</th>
                    </tr>
                </thead>
                <tbody>
                    {zahlungenHistorisch.flatMap((z) => {
                        const st = zahlStatusDisplay(z.status);
                        const bezugLine = formatZahlungBezugLine(z, behandlungen, untersuchungen);
                        let bezug = "—";
                        if (z.behandlung_id) {
                            const b = behandlungen.find((x) => x.id === z.behandlung_id);
                            const bn = (b?.behandlungsnummer ?? "").trim();
                            bezug = bn ? `B ${bn}` : "Behandlung";
                        } else if (z.untersuchung_id) {
                            const u = untersuchungen.find((x) => x.id === z.untersuchung_id);
                            const un = (u?.untersuchungsnummer ?? "").trim();
                            bezug = un ? `U ${un}` : "Untersuchung";
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
                                    <div className="zahl-td-clip" title={zahlungsartLabel(z.zahlungsart)}>
                                        {zahlungsartLabel(z.zahlungsart)}
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
                                            Quittung
                                        </Button>
                                        {canViewClinical ? (
                                            itemValidation[itemValidationKey("zahl", z.id)] ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        void revokeItemValidationRow(
                                                            itemValidationKey("zahl", z.id),
                                                            `Zahlung ${z.betrag.toFixed(2)} €`,
                                                        )}
                                                >
                                                    Prüfung zurücksetzen
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        void requestValidateItem(
                                                            itemValidationKey("zahl", z.id),
                                                            `Zahlung ${formatDate(z.created_at)} · ${z.betrag.toFixed(2)} €`,
                                                        )}
                                                >
                                                    <ShieldCheckIcon />Validieren
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
                                                    Bearbeiten
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    disabled={z.status !== "AUSSTEHEND" && z.status !== "TEILBEZAHLT"}
                                                    onClick={() => onRequestDeleteZahlung(z.id)}
                                                >
                                                    Löschen
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
                                            ariaLabel="Zahlung bearbeiten"
                                            title="Zahlung bearbeiten"
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
                title="Zahlung löschen"
                message={(() => {
                    const z = zahlungen.find((x) => x.id === zahlDeleteId);
                    return z
                        ? `Die Zahlung über ${z.betrag.toFixed(2)} € (${z.zahlungsart}, ${z.status}) wirklich löschen?`
                        : "Nur ausstehende oder teilbezahlte Zahlungen können gelöscht werden. Fortfahren?";
                })()}
                onCancel={onCancelDeleteZahlung}
                onConfirm={() => void onDeleteZahlung()}
                confirmLabel="Ja, löschen"
                danger
            />
        ) : null}
        {canFinanzenWrite && zahlEdit && zahlListenModus !== "historie" ? (
            <AkteEditFormOrInline
                area="patient_akte_zahlung_edit"
                open={canFinanzenWrite && !!zahlEdit}
                onClose={onCloseZahlEdit}
                title="Zahlung bearbeiten"
                subtitle={zahlEditPanelSubtitle}
                inlineId="ak-zahl-edit-panel"
                ariaLabel="Zahlung bearbeiten"
                presentationOverride="inline"
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
