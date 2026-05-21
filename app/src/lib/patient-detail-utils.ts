import { deriveAnlageDisplayName } from "@/lib/akte-anlagen";
import { formatDate, formatDateTime } from "@/lib/utils";
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

export const PATIENT_DETAIL_TAB_IDS = ["stamm", "anam", "unter", "behand", "rezept", "anlage", "zahl"] as const;
export type PatientDetailAkteTab = (typeof PATIENT_DETAIL_TAB_IDS)[number];

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
    switch (p.kind) {
        case "rezept_finalize_vorlage":
            return {
                title: "Vorlage und Rezepte speichern",
                message: `Praxis-Vorlage „${p.titel}“ anlegen und ${p.lines.length} Rezeptzeile${p.lines.length === 1 ? "" : "n"} speichern?`,
                confirmLabel: "Speichern",
            };
        case "attest_finalize_vorlage":
            return {
                title: "Vorlage und Attest speichern",
                message: `Praxis-Vorlage „${p.titel}“ anlegen und das Attest für diesen Patienten speichern?`,
                confirmLabel: "Speichern",
            };
        case "anlage_add":
            return {
                title: "Anlage hinzufügen",
                message: `Die Datei „${deriveAnlageDisplayName(p.file)}“ dauerhaft in der Akte speichern?`,
                confirmLabel: "Hinzufügen",
            };
        case "anlage_remove":
            return {
                title: "Anlage entfernen",
                message: `„${p.name}“ aus den Anlagen entfernen?`,
                confirmLabel: "Entfernen",
            };
        default:
            return { title: "Bestätigen", message: "Fortfahren?", confirmLabel: "OK" };
    }
}

export function patientDetailTabFromHash(hash: string): PatientDetailAkteTab | null {
    const h = hash.replace(/^#/, "");
    return PATIENT_DETAIL_TAB_IDS.includes(h as PatientDetailAkteTab) ? (h as PatientDetailAkteTab) : null;
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
