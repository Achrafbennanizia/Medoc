import { deriveAnlageDisplayName } from "@/lib/akte-anlagen";
import { formatDate, formatDateTime } from "@/lib/utils";
import { t, translateLocaleParams, useLocale } from "@/lib/i18n";
import type { RezeptLine } from "@/lib/medikamente";
import type { AttestComposerFormFields } from "@/lib/attest-composer";
import type { Behandlung, BehandlungsKatalogItem } from "@/models/types";

export function validateRezeptLine(line: RezeptLine): string | null {
    if (!line.medikament.trim()) return "Bitte Medikament angeben.";
    if (!line.dosierung.trim()) return "Bitte Dosierung angeben.";
    if (!line.dauer.trim()) return "Bitte Dauer angeben.";
    return null;
}

export function isPatientenakteMissingError(e: unknown): boolean {
    const m = e instanceof Error ? e.message : String(e);
    return m.includes("Patientenakte nicht gefunden") || /Patientenakte.*?nicht gefunden/i.test(m);
}

export const PATIENT_DETAIL_TAB_IDS = ["anam", "unter", "behand", "rezept", "anlage", "zahl"] as const;
export type PatientDetailAkteTab = (typeof PATIENT_DETAIL_TAB_IDS)[number];

/** Default akte sub-nav tab when no hash is present (Stammdaten live in the hero header). */
export function patientDetailDefaultTab(canViewClinical: boolean): PatientDetailAkteTab {
    return canViewClinical ? "anam" : "rezept";
}

/** Tabs that require `patient.read_medical` (GAP-01 / REZ need-to-know). */
export const CLINICAL_PATIENT_DETAIL_TABS = ["anam", "unter", "behand"] as const satisfies readonly PatientDetailAkteTab[];

export function patientDetailTabBlocked(tab: PatientDetailAkteTab, canViewClinical: boolean): boolean {
    if (canViewClinical) return false;
    return (CLINICAL_PATIENT_DETAIL_TABS as readonly PatientDetailAkteTab[]).includes(tab);
}

/** Whether the akte sub-nav tab should render (RBAC: hide blocked tabs for REZEPTION). */
export function patientDetailTabVisible(tab: PatientDetailAkteTab, canViewClinical: boolean): boolean {
    return !patientDetailTabBlocked(tab, canViewClinical);
}

export type RezeptWizardStep = null | "pick" | "compose" | "ask_vorlage" | "name_vorlage";
export type AttestWizardStep = null | "pick" | "compose" | "ask_vorlage" | "name_vorlage";

/** Bestätigung nur für sensible Aktionen (Vorlage + Rezepte, Anlagen). */
export type AkteSavePending =
    | { kind: "rezept_finalize_vorlage"; titel: string; lines: RezeptLine[]; shared: string }
    | { kind: "attest_finalize_vorlage"; titel: string; fields: AttestComposerFormFields }
    | { kind: "anlage_add"; file: File }
    | { kind: "anlage_remove"; id: string; name: string };

export const PATIENT_DETAIL_TOAST_UNDO_MS = 5200;

export function akteSaveConfirmUi(p: AkteSavePending): { title: string; message: string; confirmLabel: string } {
    const locale = useLocale.getState().locale;
    const tp = (key: string, params: Record<string, string | number>) =>
        translateLocaleParams(locale, key, params);
    switch (p.kind) {
        case "rezept_finalize_vorlage":
            return {
                title: t("patient.detail.confirm.rezept_vorlage_title"),
                message: tp("patient.detail.confirm.rezept_vorlage_message", {
                    title: p.titel,
                    count: p.lines.length,
                    suffix: p.lines.length === 1 ? "" : "n",
                }),
                confirmLabel: t("common.save"),
            };
        case "attest_finalize_vorlage":
            return {
                title: t("patient.detail.confirm.attest_vorlage_title"),
                message: tp("patient.detail.confirm.attest_vorlage_message", { title: p.titel }),
                confirmLabel: t("common.save"),
            };
        case "anlage_add":
            return {
                title: t("patient.detail.confirm.anlage_add_title"),
                message: tp("patient.detail.confirm.anlage_add_message", {
                    name: deriveAnlageDisplayName(p.file),
                }),
                confirmLabel: t("common.add"),
            };
        case "anlage_remove":
            return {
                title: t("patient.detail.confirm.anlage_remove_title"),
                message: tp("patient.detail.confirm.anlage_remove_message", { name: p.name }),
                confirmLabel: t("common.remove"),
            };
        default:
            return {
                title: t("patient.detail.confirm.generic_title"),
                message: t("patient.detail.confirm.generic_message"),
                confirmLabel: t("common.ok"),
            };
    }
}

export function patientDetailTabFromHash(hash: string): PatientDetailAkteTab | null {
    const h = hash.replace(/^#/, "");
    if (h === "stamm") return null;
    return PATIENT_DETAIL_TAB_IDS.includes(h as PatientDetailAkteTab) ? (h as PatientDetailAkteTab) : null;
}

/** Resolves hash to tab id; legacy `#stamm` maps to the default tab. */
export function resolvePatientDetailTabFromHash(
    hash: string,
    canViewClinical: boolean,
): PatientDetailAkteTab | null {
    const h = hash.replace(/^#/, "");
    if (h === "stamm") return patientDetailDefaultTab(canViewClinical);
    return patientDetailTabFromHash(hash);
}

export function rezeptStatusDisplay(status: string): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    if (s === "AUSGESTELLT") return { variant: "success", label: "Ausgestellt" };
    if (s === "ENTWURF") return { variant: "warning", label: "Entwurf" };
    return { variant: "default", label: s || "—" };
}

export function resolveKatalogIdForBehandlung(katalog: BehandlungsKatalogItem[], b: Behandlung): string {
    const name = (b.leistungsname || b.beschreibung || "").trim();
    if (!name) return "";
    const exact = katalog.find((k) => k.name === name);
    if (exact) return exact.id;
    const sub = katalog.find((k) => name.includes(k.name) || k.name.includes(name));
    return sub?.id ?? "";
}

export function behandlungToUpdatePayload(b: Behandlung) {
    return {
        id: b.id,
        art: b.art,
        beschreibung: b.beschreibung,
        zaehne: b.zaehne,
        material: b.material,
        notizen: b.notizen,
        kategorie: b.kategorie ?? null,
        leistungsname: b.leistungsname ?? null,
        behandlungsnummer: b.behandlungsnummer,
        sitzung: b.sitzung,
        behandlung_status: b.behandlung_status,
        gesamtkosten: b.gesamtkosten,
        termin_erforderlich: (b.termin_erforderlich ?? 0) === 1,
        behandlung_datum: b.behandlung_datum,
    };
}

export function behandlungContinueLabel(b: Behandlung): string {
    const bn = (b.behandlungsnummer ?? "").trim() || "—";
    const sitz = b.sitzung != null ? String(b.sitzung) : "?";
    const titel = b.leistungsname || b.beschreibung || b.art;
    const d = b.behandlung_datum ? formatDate(b.behandlung_datum) : formatDateTime(b.created_at);
    return `${bn} · Sitzung ${sitz} · ${titel} · ${d}`;
}

export function alterAusGeburtsdatum(geburtsdatum: string): number | null {
    const raw = geburtsdatum.slice(0, 10);
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a -= 1;
    return Math.max(0, a);
}
