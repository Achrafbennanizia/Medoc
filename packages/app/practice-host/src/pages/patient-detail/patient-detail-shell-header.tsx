import type { AkteCompletenessGap } from "@/lib/akte-completeness";
import { CalendarIcon, ExportIcon, MailIcon, PhoneIcon } from "@/lib/icons";
import { WorkspacePageHeader } from "@/views/components/verwaltung-page-header";
import { emptyPlanNextTermin, planNextHasContent, type PlanNextTerminV2 } from "@/lib/plan-next-termin";
import { alterAusGeburtsdatum } from "@/lib/patient-detail-utils";
import type { PatientDetailAkteTab } from "@/lib/patient-detail-utils";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Zahlung, Rolle } from "@/models/types";
import { formatDate } from "@/lib/utils";
import { DentalMiniBar } from "@/views/components/DentalMiniBar";
import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input, Select, Textarea } from "@/views/components/ui/input";

export type PatientDetailShellHeaderProps = {
    patient: Patient;
    validationPendingTotal: number;
    completenessGaps: AkteCompletenessGap[];
    showPlanTip: boolean;
    planNext: PlanNextTerminV2;
    canViewClinical: boolean;
    role: Rolle | null;
    patientId: string;
    akte: Patientenakte | null;
    befunde: Zahnbefund[];
    behandlungen: Behandlung[];
    zahlungen: Zahlung[];
    onNavigateBack: () => void;
    onTogglePlanTip: () => void;
    onPersistPlanNext: (next: PlanNextTerminV2) => void;
    onOpenExport: () => void;
    onOpenTicket: () => void;
    onOpenAufgabe: () => void;
    onOpenForward: () => void;
    onOpenDischargeMerkblatt: () => void;
    onOpenTermin: () => void;
    onGoTab: (tab: PatientDetailAkteTab) => void;
};

export function PatientDetailShellHeader({
    patient,
    validationPendingTotal,
    completenessGaps,
    showPlanTip,
    planNext,
    canViewClinical,
    role,
    patientId,
    akte,
    befunde,
    behandlungen,
    zahlungen,
    onNavigateBack,
    onTogglePlanTip,
    onPersistPlanNext,
    onOpenExport,
    onOpenTicket,
    onOpenAufgabe,
    onOpenForward,
    onOpenDischargeMerkblatt,
    onOpenTermin,
    onGoTab,
}: PatientDetailShellHeaderProps) {
    return (
        <>
            <WorkspacePageHeader
                titleLevel="h1"
                title={
                    <>
                        Akte von {patient.name}
                        {canViewClinical && validationPendingTotal > 0 ? (
                            <span
                                className="tab-badge warn"
                                style={{ marginLeft: 10, verticalAlign: "middle" }}
                                title={`${validationPendingTotal} offene Punkt${validationPendingTotal === 1 ? "" : "e"} zur ärztlichen Validierung`}
                            >
                                {validationPendingTotal}
                            </span>
                        ) : null}
                        {canViewClinical && completenessGaps.length > 0 ? (
                            <span
                                className="tab-badge muted"
                                style={{ marginLeft: 8, verticalAlign: "middle" }}
                                title={`${completenessGaps.length} offene${completenessGaps.length === 1 ? "r" : ""} Pflicht${completenessGaps.length === 1 ? "punkt" : "punkte"} (Heuristik)`}
                            >
                                {completenessGaps.length} offen
                            </span>
                        ) : null}
                    </>
                }
                back={{ onClick: onNavigateBack, label: "Patienten" }}
                actions={
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={onTogglePlanTip}
                        title="Hinweise an die Rezeption für die nächste Terminplanung"
                        aria-pressed={showPlanTip}
                        style={
                            planNextHasContent(planNext)
                                ? { borderColor: "var(--accent)", color: "var(--accent-ink)", background: "var(--accent-soft)" }
                                : undefined
                        }
                    >
                        <CalendarIcon />
                        Plan nächsten Termin
                        {planNextHasContent(planNext) ? (
                            <span
                                aria-hidden
                                title="Inhalt eingetragen"
                                style={{
                                    display: "inline-block",
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "var(--accent)",
                                    marginLeft: 6,
                                    verticalAlign: "middle",
                                }}
                            />
                        ) : null}
                    </button>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={onOpenExport}
                        disabled={!patientId}
                        title="Export — Bereiche, Format, Speicherort"
                    >
                        <ExportIcon />
                        Exportieren
                    </button>
                    {role === "REZEPTION" ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenTicket}
                            title="Strukturiertes Ticket an einen Arzt (FA-PERS-08)"
                        >
                            Ticket an Arzt
                        </button>
                    ) : null}
                    {role === "ARZT" ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenAufgabe}
                            title="Aufgabe an Rezeption (FA-AUFG-02)"
                        >
                            Aufgabe an Rezeption
                        </button>
                    ) : null}
                    {role === "ARZT" || role === "REZEPTION" ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenForward}
                            title="Kolleg:innen per Benachrichtigung um Akten-Review bitten"
                        >
                            Review anfragen
                        </button>
                    ) : null}
                    {canViewClinical ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={onOpenDischargeMerkblatt}
                            disabled={!patientId}
                            title="Entlassungs-Merkblatt / Nachsorge (PDF, FA-DOK-08)"
                        >
                            Merkblatt
                        </button>
                    ) : null}
                    <button type="button" className="btn btn-accent" onClick={onOpenTermin}>
                        <CalendarIcon />
                        Termin
                    </button>
                </div>
                }
            />
            {canViewClinical && completenessGaps.length > 0 ? (
                <DismissibleNotice
                    variant="warning"
                    role="region"
                    ariaLabel="Aktenvollständigkeit"
                    title="Akte — fehlende Einträge (Hinweis)"
                    subtitle="Heuristik gemäß FA-AKTE-16; kein Ersatz für klinische Beurteilung. Klick springt zum passenden Reiter."
                    dismissKey={`akte-gaps-${patientId}-${completenessGaps.map((g) => g.id).sort().join("-")}`}
                    actions={
                        <>
                            {completenessGaps.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    className="btn btn-subtle btn-sm"
                                    onClick={() => onGoTab(g.tab as PatientDetailAkteTab)}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </>
                    }
                />
            ) : null}
            {showPlanTip ? (
                <PlanNextTipCard planNext={planNext} canViewClinical={canViewClinical} onPersistPlanNext={onPersistPlanNext} onClose={onTogglePlanTip} />
            ) : null}
            <div className="card patient-hero-card">
                <div className="patient-hero-top">
                    <div className="patient-hero-identity">
                        <div className="av av-lg av--accent" aria-hidden>
                            {patient.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                        </div>
                        <div className="patient-hero-identity-text">
                            <h2 className="patient-hero-name">{patient.name}</h2>
                            <div className="patient-hero-badges">
                                <Badge variant="primary">{patient.status}</Badge>
                                {zahlungen.some(
                                    (z) =>
                                        z.patient_id === patient.id && (z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT"),
                                ) ? (
                                    <Badge variant="warning">Rechnung offen</Badge>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {canViewClinical && akte ? (
                        <div className="patient-hero-dental">
                            <DentalMiniBar befunde={befunde} behandlungen={behandlungen} visible />
                        </div>
                    ) : null}
                </div>
                <div className="patient-hero-contacts">
                    <span className="patient-hero-contact" title="Geburtstag / Alter">
                        <CalendarIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">
                            {formatDate(patient.geburtsdatum)}
                            {(() => {
                                const alter = alterAusGeburtsdatum(patient.geburtsdatum);
                                return alter != null ? (
                                    <>
                                        <span className="patient-hero-contact__sep"> · </span>
                                        <strong className="patient-hero-contact__age">{alter} J.</strong>
                                    </>
                                ) : null;
                            })()}
                        </span>
                    </span>
                    <span className="patient-hero-contact" title="Telefon">
                        <PhoneIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">{patient.telefon || "—"}</span>
                    </span>
                    <span className="patient-hero-contact" title="E-Mail / Versicherung">
                        <MailIcon size={12} aria-hidden />
                        <span className="patient-hero-contact__text">
                            {patient.email || "—"}
                            {patient.versicherungsnummer ? (
                                <>
                                    <span className="patient-hero-contact__sep"> · </span>
                                    V: {patient.versicherungsnummer}
                                </>
                            ) : null}
                        </span>
                    </span>
                </div>
            </div>
        </>
    );
}

function PlanNextTipCard({
    planNext,
    canViewClinical,
    onPersistPlanNext,
    onClose,
}: {
    planNext: PlanNextTerminV2;
    canViewClinical: boolean;
    onPersistPlanNext: (next: PlanNextTerminV2) => void;
    onClose: () => void;
}) {
    return (
        <DismissibleNotice
            variant="accent"
            role="region"
            ariaLabel="Terminplanung für Rezeption"
            title="Hinweis für die Rezeption"
            subtitle='Kurz halten — erscheint kompakt im Dashboard unter „Ausstehende Freigaben“ mit Direktlink zu „Neuer Termin“.'
            onDismiss={onClose}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                    id="plan-urgency"
                    label="Dringlichkeit"
                    value={planNext.urgency}
                    onChange={(e) => onPersistPlanNext({ ...planNext, urgency: e.target.value as PlanNextTerminV2["urgency"] })}
                    options={[
                        { value: "routine", label: "Routine" },
                        { value: "bald", label: "Zeitnah" },
                        { value: "dringend", label: "Dringend" },
                    ]}
                />
                <Select
                    id="plan-art"
                    label="Terminart (Vorschlag)"
                    value={planNext.terminArtHint}
                    onChange={(e) => onPersistPlanNext({ ...planNext, terminArtHint: e.target.value })}
                    options={[
                        { value: "", label: "— offen —" },
                        { value: "KONTROLLE", label: "Kontrolle" },
                        { value: "BEHANDLUNG", label: "Behandlung" },
                        { value: "UNTERSUCHUNG", label: "Untersuchung" },
                        { value: "BERATUNG", label: "Beratung" },
                        { value: "ERSTBESUCH", label: "Erstbesuch" },
                    ]}
                />
                <Input
                    id="plan-dur"
                    type="number"
                    min={5}
                    step={5}
                    label="Dauer (Min.)"
                    value={planNext.durationMin}
                    onChange={(e) => onPersistPlanNext({ ...planNext, durationMin: e.target.value })}
                    placeholder="z. B. 30"
                />
            </div>
            <Input
                id="patient-plan-freetext"
                label="Kurztext (max. eine Zeile)"
                value={planNext.freeText}
                onChange={(e) => onPersistPlanNext({ ...planNext, freeText: e.target.value.slice(0, 140) })}
                placeholder="z. B. Füllung 36 — Kontrolle in 2 Wo."
                style={{ marginTop: 12 }}
            />
            <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--fg-2)" }}>
                    Weitere Angaben (optional)
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginTop: 12 }}>
                    <Select
                        id="plan-interval"
                        label="Abstand (Orientierung)"
                        value={planNext.intervalWeeks}
                        onChange={(e) => onPersistPlanNext({ ...planNext, intervalWeeks: e.target.value })}
                        options={[
                            { value: "", label: "— —" },
                            { value: "2", label: "ca. 2 Wochen" },
                            { value: "4", label: "ca. 4 Wochen" },
                            { value: "6", label: "ca. 6 Wochen" },
                            { value: "12", label: "ca. 12 Wochen" },
                            { value: "26", label: "ca. 6 Monate" },
                        ]}
                    />
                    <Input
                        id="plan-days"
                        label="Bevorzugte Wochentage"
                        value={planNext.preferredWeekdays}
                        onChange={(e) => onPersistPlanNext({ ...planNext, preferredWeekdays: e.target.value })}
                        placeholder="z. B. Mo, Do"
                    />
                </div>
                {canViewClinical ? (
                    <Textarea
                        id="patient-plan-internal"
                        label="Intern (nicht im Dashboard sichtbar)"
                        rows={2}
                        value={planNext.internalNote}
                        onChange={(e) => onPersistPlanNext({ ...planNext, internalNote: e.target.value })}
                        placeholder="Nur Praxis-intern"
                        style={{ marginTop: 12 }}
                    />
                ) : null}
            </details>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                {planNextHasContent(planNext) ? (
                    <Button size="sm" variant="ghost" onClick={() => onPersistPlanNext(emptyPlanNextTermin())}>
                        Hinweis leeren
                    </Button>
                ) : null}
            </div>
        </DismissibleNotice>
    );
}
