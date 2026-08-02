import { useLocale, bcp47ForLocale } from "@/lib/i18n";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import {
    getAkte,
    getAnamnesebogen,
    listAkteAnlagen,
    listBehandlungen,
    listUntersuchungen,
    listZahnbefunde,
} from "@/systems/practice-host/controllers/akte.controller";
import { listAtteste, type Attest } from "@/systems/practice-host/controllers/attest.controller";
import { listRezepte, type Rezept } from "@/systems/practice-host/controllers/rezept.controller";
import { listZahlungenForPatient } from "@/systems/practice-host/controllers/zahlung.controller";
import type { AkteAnlageRowDto } from "./akte-anlagen";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Untersuchung, Zahlung } from "@/models/types";

/**
 * Normative / de-facto patterns for exports (information model, no certification):
 * – ISO 13606-1:2019 — EHR communication, "EHR_EXTRACT" as overarching communication framework
 *   (@see https://www.iso.org/standard/67868.html )
 * – HL7 FHIR R4 — Bundle (type collection/document) + Composition for document-style assembly
 *   (@see https://www.hl7.org/fhir/R4/documents.html , https://www.hl7.org/fhir/R4/composition.html )
 * – EU GDPR Art. 20 — structured, common, machine-readable formats (incl. JSON, XML, CSV)
 *   (@see https://gdpr-info.eu/art-20-gdpr/ )
 * – ISO 22600:2014 — privilege/access context reflected in filtered export data
 *   (practice: RBAC on creation)
 */
export const AKTE_EXPORT_PROFILE_URI = "urn:medoc:export:akte:1.1.0";

export const AKTE_EXPORT_STANDARDS_REFS: {
    system?: string;
    reference: string;
    display: string;
}[] = [
    {
        system: "https://www.iso.org/standard/67868.html",
        reference: "https://www.iso.org/standard/67868.html",
        display: "ISO 13606-1:2019 — Electronic health record communication (reference model / extract-oriented packaging)",
    },
    {
        reference: "https://www.hl7.org/fhir/R4/documents.html",
        display: "HL7 FHIR R4 — Documents / Bundle patterns (informative mapping)",
    },
    {
        reference: "https://www.hl7.org/fhir/R4/composition.html",
        display: "HL7 FHIR R4 — Composition resource",
    },
    {
        reference: "https://gdpr-info.eu/art-20-gdpr/",
        display: "GDPR Article 20 — structured, commonly used, machine-readable format",
    },
];

/** LOINC 11506-3 — Progress note (als allgemeiner klinischer Verlaufs-/Akten-Container). */
export const LOINC_PROGRESS_NOTE = "11506-3";

export type AkteExportFileFormat = "pdf" | "json" | "xml" | "csv";

export type AkteExportSectionsState = {
    patient: boolean;
    akteCore: boolean;
    zahnbefunde: boolean;
    anamnese: boolean;
    untersuchungen: boolean;
    behandlungen: boolean;
    rezepte: boolean;
    attest: boolean;
    zahlungen: boolean;
    anlagen: boolean;
    /** Requires audit.read */
    audit: boolean;
};

export const AKTE_EXPORT_SECTION_META: {
    key: keyof AkteExportSectionsState;
    /** @deprecated Use {@link akteExportSectionLabel} — kept for tests/fallback. */
    label: string;
    needsMedical: boolean;
    needsDocuments?: boolean;
    needsFinanzen?: boolean;
    needsAuditRead?: boolean;
}[] = [
    { key: "patient", label: "Master data", needsMedical: false },
    { key: "akteCore", label: "Patient record (status, diagnosis, findings)", needsMedical: true },
    { key: "anamnese", label: "Medical history", needsMedical: true },
    { key: "behandlungen", label: "Treatments", needsMedical: true },
    { key: "untersuchungen", label: "Examinations", needsMedical: true },
    { key: "zahnbefunde", label: "Dental findings", needsMedical: true },
    { key: "rezepte", label: "Prescriptions", needsMedical: false, needsDocuments: true },
    { key: "attest", label: "Certificates", needsMedical: false, needsDocuments: true },
    { key: "anlagen", label: "Attachments", needsMedical: false },
    { key: "zahlungen", label: "Payments", needsMedical: false, needsFinanzen: true },
    { key: "audit", label: "Audit extract", needsMedical: false, needsAuditRead: true },
];

/** Localized label for export section checkbox (Akte export picker). */
export function akteExportSectionLabel(
    key: keyof AkteExportSectionsState,
    t: (translationKey: string) => string,
): string {
    return t(`export.section.${key}`);
}

export function defaultAkteExportSections(): AkteExportSectionsState {
    return {
        patient: true,
        akteCore: true,
        zahnbefunde: true,
        anamnese: true,
        untersuchungen: true,
        behandlungen: true,
        rezepte: true,
        attest: true,
        zahlungen: true,
        anlagen: true,
        audit: false,
    };
}

export function slugPatientName(name: string): string {
    const s = name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 48);
    return s || "Patient";
}

/** Suggestions: ISO-like unique first, then readable. */
export function suggestAkteExportFilenames(patient: Patient, ext: string): string[] {
    const id8 = patient.id.replace(/-/g, "").slice(0, 8);
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const hms = d.toTimeString().slice(0, 8).replace(/:/g, "");
    const isoCompact = d.toISOString().replace(/\D/g, "").slice(0, 14);
    const slug = slugPatientName(patient.name);
    return [
        `MeDoc-Akte-${id8}-${ymd}-${hms}.${ext}`,
        `Patientenakte-${slug}-${id8}.${ext}`,
        `Akte-Export-${patient.id}-${isoCompact}.${ext}`,
    ];
}

export type AkteExportSnapshot = {
    exportMeta: { generatedAt: string; app: string };
    patient: Patient;
    akte: Patientenakte;
    zahnbefunde: Zahnbefund[];
    anamnese: { antworten: string; unterschrieben: boolean } | null;
    untersuchungen: Untersuchung[];
    behandlungen: Behandlung[];
    rezepte: Rezept[];
    attest: Attest[];
    zahlungen: Zahlung[];
    anlagen: AkteAnlageRowDto[];
};

export async function loadAkteExportSnapshot(
    patientId: string,
    opts: { loadClinical: boolean },
): Promise<AkteExportSnapshot> {
    const patient = await getPatient(patientId);
    const akte = await getAkte(patientId);
    const generatedAt = new Date().toISOString();

    const [rezepte, attest, anlagen] = await Promise.all([
        opts.loadClinical ? listRezepte(patientId) : Promise.resolve([] as Rezept[]),
        opts.loadClinical ? listAtteste(patientId) : Promise.resolve([] as Attest[]),
        listAkteAnlagen(akte.id),
    ]);

    let zahnbefunde: Zahnbefund[] = [];
    let anamnese: AkteExportSnapshot["anamnese"] = null;
    let untersuchungen: Untersuchung[] = [];
    let behandlungen: Behandlung[] = [];

    if (opts.loadClinical) {
        const [z, u, b, am] = await Promise.all([
            listZahnbefunde(akte.id),
            listUntersuchungen(akte.id),
            listBehandlungen(akte.id),
            getAnamnesebogen(patientId),
        ]);
        zahnbefunde = z;
        untersuchungen = u;
        behandlungen = b;
        if (am) {
            anamnese = { antworten: am.antworten, unterschrieben: am.unterschrieben };
        }
    }

    let zahlungen: Zahlung[] = [];
    try {
        zahlungen = await listZahlungenForPatient(patientId);
    } catch {
        zahlungen = [];
    }

    return {
        exportMeta: { generatedAt, app: "MeDoc" },
        patient,
        akte,
        zahnbefunde,
        anamnese,
        untersuchungen,
        behandlungen,
        rezepte,
        attest,
        zahlungen,
        anlagen,
    };
}

export function filterSnapshotBySections(
    snap: AkteExportSnapshot,
    sec: AkteExportSectionsState,
): Record<string, unknown> {
    const o: Record<string, unknown> = { exportMeta: snap.exportMeta };
    if (sec.patient) o.patient = snap.patient;
    if (sec.akteCore) o.akte = snap.akte;
    if (sec.zahnbefunde) o.zahnbefunde = snap.zahnbefunde;
    if (sec.anamnese) o.anamnese = snap.anamnese;
    if (sec.untersuchungen) o.untersuchungen = snap.untersuchungen;
    if (sec.behandlungen) o.behandlungen = snap.behandlungen;
    if (sec.rezepte) o.rezepte = snap.rezepte;
    if (sec.attest) o.attest = snap.attest;
    if (sec.zahlungen) o.zahlungen = snap.zahlungen;
    if (sec.anlagen) o.anlagen = snap.anlagen;
    return o;
}

function newUuid(): string {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function mapGenderAdministrativeToFhir(g: string): string {
    const u = g.toUpperCase();
    if (u === "MAENNLICH" || u === "MALE") return "male";
    if (u === "WEIBLICH" || u === "FEMALE") return "female";
    return "unknown";
}

/** FHIR R4 Patient subset — interoperability wrapper only (no full validation profile). */
export function toFhirPatientResource(p: Patient): Record<string, unknown> {
    const id = p.id.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 64) || "patient";
    return {
        resourceType: "Patient",
        id,
        identifier: [{ value: p.id, system: "urn:medoc:patient-id" }],
        name: [{ text: p.name }],
        telecom: [
            ...(p.telefon ? [{ system: "phone", value: p.telefon }] : []),
            ...(p.email ? [{ system: "email", value: p.email }] : []),
        ],
        gender: mapGenderAdministrativeToFhir(p.geschlecht),
        birthDate: p.geburtsdatum.slice(0, 10),
        address: p.adresse ? [{ text: p.adresse }] : [],
    };
}

function xhtmlDivEscape(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function narrativeDivFromText(body: string): string {
    const parts = body.split("\n").map((p) => (p.trim() === "" ? "<br/>" : `<p>${xhtmlDivEscape(p)}</p>`));
    return `<div xmlns="http://www.w3.org/1999/xhtml">${parts.join("")}</div>`;
}

/**
 * FHIR R4-konformes Umschlag-Muster: Bundle type=collection + Composition + Patient.
 * Informally matches HL7 document/collection pattern; not declared as validated IHE document.
 */
export function buildFhirInteropBundle(
    snap: AkteExportSnapshot,
    medocDomainPayload: Record<string, unknown>,
    sec: AkteExportSectionsState,
): Record<string, unknown> {
    const bundleId = newUuid();
    const patientRef = "Patient/medoc-patient-1";
    const compositionId = "medoc-composition-1";
    const patientIncluded = Boolean(sec.patient && medocDomainPayload.patient);
    const patient = patientIncluded ? toFhirPatientResource(snap.patient) : null;

    const sections: Record<string, unknown>[] = [];
    for (const row of AKTE_EXPORT_SECTION_META) {
        if (!sec[row.key]) continue;
        const key = row.key === "akteCore" ? "akte" : row.key;
        const data = medocDomainPayload[key];
        if (data === undefined) continue;
        const json = JSON.stringify(data, null, 2);
        sections.push({
            title: row.label,
            code: {
                coding: [
                    {
                        system: "urn:medoc:export-section",
                        code: row.key,
                        display: row.label,
                    },
                ],
            },
            text: {
                status: "generated",
                div: narrativeDivFromText(json),
            },
        });
    }

    const composition: Record<string, unknown> = {
        resourceType: "Composition",
        id: compositionId,
        meta: {
            profile: [`${AKTE_EXPORT_PROFILE_URI}#composition`],
        },
        status: "final",
        type: {
            coding: [
                {
                    system: "http://loinc.org",
                    code: LOINC_PROGRESS_NOTE,
                    display: "Progress note",
                },
            ],
            text: "MeDoc Aktenauszug / Patient record extract",
        },
        subject: patientIncluded
            ? { reference: patientRef, display: snap.patient.name }
            : undefined,
        date: snap.exportMeta.generatedAt,
        author: [{ display: `${snap.exportMeta.app} export` }],
        title: "MeDoc — Patientenakte (Auszug)",
        confidentiality: {
            coding: [
                {
                    system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                    code: "N",
                    display: "normal",
                },
            ],
        },
        section: sections,
    };

    if (!patientIncluded) {
        delete composition.subject;
    }

    const entry: { fullUrl: string; resource: Record<string, unknown> }[] = [
        { fullUrl: `urn:uuid:${compositionId}`, resource: composition },
    ];
    if (patient && patientIncluded) {
        entry.push({
            fullUrl: `urn:uuid:${patient.id}`,
            resource: { ...patient, id: "medoc-patient-1" },
        });
    }

    return {
        resourceType: "Bundle",
        id: bundleId,
        meta: {
            profile: [AKTE_EXPORT_PROFILE_URI],
            lastUpdated: snap.exportMeta.generatedAt,
        },
        type: "collection",
        timestamp: snap.exportMeta.generatedAt,
        entry,
    };
}

export function buildDocumentManifest(
    snap: AkteExportSnapshot,
    sec: AkteExportSectionsState,
): Record<string, unknown> {
    return {
        exportProfile: AKTE_EXPORT_PROFILE_URI,
        schemaVersion: "1.1.0",
        generatedAt: snap.exportMeta.generatedAt,
        generator: {
            name: snap.exportMeta.app,
            product: "MeDoc patient record export",
        },
        language: bcp47ForLocale(useLocale.getState().locale),
        rbacFilteredSections: sec,
        conformanceDisclaimer:
            "Mapping to FHIR R4 and an ISO-13606-oriented extract pattern is informative; this is not a certified HL7 or EN-13606 export.",
        standardsAlignment: AKTE_EXPORT_STANDARDS_REFS,
        gdprNote:
            "Machine-readable JSON/XML/CSV sub-formats support common GDPR Art. 20 requirements (structured, commonly used, machine-readable). Scope and legal bases of the provided data must still be observed.",
    };
}

/** Full JSON export with interoperability wrapper + domain MeDoc payload. */
export function buildInteroperableAkteJson(
    snap: AkteExportSnapshot,
    sec: AkteExportSectionsState,
): Record<string, unknown> {
    const medocDomainPayload = filterSnapshotBySections(snap, sec);
    return {
        documentManifest: buildDocumentManifest(snap, sec),
        fhirBundle: buildFhirInteropBundle(snap, medocDomainPayload, sec),
        medocDomainPayload,
    };
}

function cdataSafe(s: string): string {
    return s.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

/** ISO-13606-/openEHR-inspired XML wrapper + embedded FHIR JSON + clinical domain tree. */
export function buildAkteExportXmlInterop(interop: Record<string, unknown>): string {
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<EhrExtract xmlns="urn:medoc:export:ehr:1.1" schemaVersion="1.1.0" ` +
            `note="Benennung informell angelehnt an ISO 13606-1 EHR_EXTRACT-Container; kein validiertes EN13606-Schema.">`,
        "  <DocumentManifest>",
    ];
    const dm = interop.documentManifest as Record<string, unknown> | undefined;
    if (dm) {
        lines.push(`    <ExportProfile>${xmlEscape(String(dm.exportProfile ?? ""))}</ExportProfile>`);
        lines.push(`    <SchemaVersion>${xmlEscape(String(dm.schemaVersion ?? ""))}</SchemaVersion>`);
        lines.push(`    <GeneratedAt>${xmlEscape(String(dm.generatedAt ?? ""))}</GeneratedAt>`);
        lines.push(`    <ConformanceDisclaimer>${xmlEscape(String(dm.conformanceDisclaimer ?? ""))}</ConformanceDisclaimer>`);
        lines.push(`    <GdprNote>${xmlEscape(String(dm.gdprNote ?? ""))}</GdprNote>`);
        const refs = dm.standardsAlignment as unknown[] | undefined;
        if (Array.isArray(refs)) {
            lines.push("    <StandardsAlignment>");
            for (const r of refs) {
                if (r && typeof r === "object") {
                    const o = r as Record<string, unknown>;
                    lines.push(
                        "      <Ref " +
                            `display="${xmlEscape(String(o.display ?? ""))}" ` +
                            `reference="${xmlEscape(String(o.reference ?? ""))}" />`,
                    );
                }
            }
            lines.push("    </StandardsAlignment>");
        }
    }
    lines.push("  </DocumentManifest>");

    const fb = interop.fhirBundle;
    if (fb) {
        lines.push('  <FhirR4Bundle mediaType="application/fhir+json">');
        lines.push(`<![CDATA[${cdataSafe(JSON.stringify(fb, null, 2))}]]>`);
        lines.push("  </FhirR4Bundle>");
    }

    lines.push("  <ClinicalRecordData>");
    const dom = interop.medocDomainPayload as Record<string, unknown> | undefined;
    if (dom) {
        const inner = buildAkteExportXml(dom).replace(/^<\?xml[^>]*>\n?/, "").replace(/^<PatientenakteExport>/, "").replace(/<\/PatientenakteExport>$/, "");
        lines.push(inner.split("\n").map((l) => (l ? `    ${l}` : "")).join("\n"));
    }
    lines.push("  </ClinicalRecordData>");
    lines.push("</EhrExtract>");
    return lines.join("\n");
}

/** CSV incl. meta lines (portability / norm notes) + flat domain section. */
export function buildAkteExportCsvFromInterop(interop: Record<string, unknown>): string {
    const rows: string[][] = [
        ["Area", "Key", "Value"],
        ["Meta", "exportProfile", String((interop.documentManifest as { exportProfile?: string })?.exportProfile ?? "")],
        ["Meta", "schemaVersion", String((interop.documentManifest as { schemaVersion?: string })?.schemaVersion ?? "")],
        ["Meta", "fhirBundleTypeHint", "Bundle.type=collection (HL7 FHIR R4 informative)"],
        ["Meta", "compositionLoinc", LOINC_PROGRESS_NOTE],
    ];
    const dm = interop.documentManifest as { standardsAlignment?: { display?: string; reference?: string }[] } | undefined;
    if (dm?.standardsAlignment) {
        dm.standardsAlignment.forEach((r, i) => {
            rows.push(["Meta", `standardRef[${i}]`, `${r.display ?? ""} | ${r.reference ?? ""}`]);
        });
    }
    const dom = interop.medocDomainPayload as Record<string, unknown> | undefined;
    if (dom) {
        const rest = buildAkteExportCsv(dom);
        const dataRows = rest.split("\n").slice(1);
        for (const line of dataRows) {
            if (!line) continue;
            const parts = parseCsvSemicolonLine(line);
            if (parts.length >= 3) rows.push(parts);
        }
    }
    const esc = (c: string): string => `"${c.replace(/"/g, '""')}"`;
    return rows.map((r) => r.map(esc).join(";")).join("\n");
}

/** Minimal CSV line parser for concatenated exports (semicolon, quotes). */
function parseCsvSemicolonLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
            if (c === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQ = false;
                }
            } else {
                cur += c;
            }
        } else {
            if (c === '"') inQ = true;
            else if (c === ";") {
                out.push(cur);
                cur = "";
            } else cur += c;
        }
    }
    out.push(cur);
    return out;
}

function xmlEscape(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function xmlTagKey(k: string): string {
    const t = k.replace(/[^a-zA-Z0-9_-]/g, "_");
    return t.match(/^[A-Za-z_]/) ? t : `_${t}`;
}

/** Simple XML wrapper for structured Akte exports (machine readability). */
export function buildAkteExportXml(data: Record<string, unknown>): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<PatientenakteExport>"];
    const walk = (tag: string, val: unknown, indent: number): void => {
        const pad = "  ".repeat(indent);
        const safeTag = xmlTagKey(tag);
        if (val === null || val === undefined) {
            lines.push(`${pad}<${safeTag} />`);
            return;
        }
        if (typeof val === "object" && !Array.isArray(val)) {
            lines.push(`${pad}<${safeTag}>`);
            for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
                walk(k, v, indent + 1);
            }
            lines.push(`${pad}</${safeTag}>`);
            return;
        }
        if (Array.isArray(val)) {
            lines.push(`${pad}<${safeTag}>`);
            val.forEach((item, i) => {
                walk(`i${i}`, item, indent + 1);
            });
            lines.push(`${pad}</${safeTag}>`);
            return;
        }
        lines.push(`${pad}<${safeTag}>${xmlEscape(String(val))}</${safeTag}>`);
    };
    for (const [k, v] of Object.entries(data)) {
        walk(k, v, 1);
    }
    lines.push("</PatientenakteExport>");
    return lines.join("\n");
}

/** CSV with `;` and header — flat rows (Bereich / key / Wert columns). */
export function buildAkteExportCsv(data: Record<string, unknown>): string {
    const rows: string[][] = [["Area", "Key", "Value"]];

    const add = (bereich: string, key: string, val: unknown): void => {
        let s = "";
        if (val === null || val === undefined) s = "";
        else if (typeof val === "object") s = JSON.stringify(val);
        else s = String(val);
        rows.push([bereich, key, s]);
    };

    for (const [bereich, val] of Object.entries(data)) {
        if (bereich === "exportMeta" && val && typeof val === "object") {
            for (const [k, v] of Object.entries(val as object)) {
                add("exportMeta", k, v);
            }
            continue;
        }
        if (Array.isArray(val)) {
            val.forEach((item, i) => {
                if (item && typeof item === "object") {
                    for (const [k, v] of Object.entries(item as object)) {
                        add(`${bereich}[${i}]`, k, v);
                    }
                } else {
                    add(bereich, String(i), item);
                }
            });
            continue;
        }
        if (val && typeof val === "object") {
            for (const [k, v] of Object.entries(val as object)) {
                add(bereich, k, v);
            }
            continue;
        }
        add(bereich, "", val);
    }

    const esc = (c: string): string => `"${c.replace(/"/g, '""')}"`;
    return rows.map((r) => r.map(esc).join(";")).join("\n");
}
