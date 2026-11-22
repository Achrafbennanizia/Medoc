import { translateLocale, useLocale, bcp47ForLocale } from "@/lib/i18n";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import {
    getChart,
    getAnamnesisForm,
    listChartAttachments,
    listTreatments,
    listExaminations,
    listDentalFindings,
} from "@/systems/practice-host/controllers/chart.controller";
import { listCertificates, type Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import { listPrescriptions, type Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import { listPaymentsForPatient } from "@/systems/practice-host/controllers/payment.controller";
import type { ChartAttachmentRowDto } from "./chart-attachments";
import type { Patient, PatientChart, DentalFinding, Treatment, Examination, Payment } from "@/models/types";
import { localIsoDate } from "@/lib/utils";
import { escapeHtml } from "./escape-html";

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
export const CHART_EXPORT_PROFILE_URI = "urn:medoc:export:chart:1.1.0";

export const CHART_EXPORT_STANDARDS_REFS: {
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

/** LOINC 34133-9: Summary of episode note (record extract handed to the patient). */
export const LOINC_SUMMARY_OF_EPISODE = "34133-9";

export type ChartExportFileFormat = "pdf" | "json" | "xml" | "csv";

export type ChartExportSectionsState = {
    patient: boolean;
    chartCore: boolean;
    dental_findings: boolean;
    anamnesis: boolean;
    examinations: boolean;
    treatments: boolean;
    prescriptions: boolean;
    certificate: boolean;
    payments: boolean;
    attachments: boolean;
    /** Requires audit.read */
    audit: boolean;
};

export const CHART_EXPORT_SECTION_META: {
    key: keyof ChartExportSectionsState;
    needsMedical: boolean;
    needsDocuments?: boolean;
    needsFinance?: boolean;
    needsAuditRead?: boolean;
}[] = [
    { key: "patient", needsMedical: false },
    { key: "chartCore", needsMedical: true },
    { key: "anamnesis", needsMedical: true },
    { key: "treatments", needsMedical: true },
    { key: "examinations", needsMedical: true },
    { key: "dental_findings", needsMedical: true },
    // Must match `apply_section_permissions` in medoc-core chart/pdf_export.rs:
    // prescriptions and certificates contain diagnoses (patient.read_medical),
    // attachments need patient.read_documents.
    { key: "prescriptions", needsMedical: true },
    { key: "certificate", needsMedical: true },
    { key: "attachments", needsMedical: false, needsDocuments: true },
    { key: "payments", needsMedical: false, needsFinance: true },
    { key: "audit", needsMedical: false, needsAuditRead: true },
];

/** Localized label for export section checkbox (Chart export picker). */
export function chartExportSectionLabel(
    key: keyof ChartExportSectionsState,
    t: (translationKey: string) => string,
): string {
    const i18nKey = key === "dental_findings" ? "dentalFindings" : key;
    return t(`export.section.${i18nKey}`);
}

export function defaultChartExportSections(): ChartExportSectionsState {
    return {
        patient: true,
        chartCore: true,
        dental_findings: true,
        anamnesis: true,
        examinations: true,
        treatments: true,
        prescriptions: true,
        certificate: true,
        payments: true,
        attachments: true,
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

/**
 * Filename suggestions. No patient names: file names end up in download
 * folders, mail subjects and cloud sync logs (GDPR Art. 5(1)(c), data minimisation).
 * Local time, so the name matches the date printed on the document.
 */
export function suggestChartExportFilenames(patient: Patient, ext: string): string[] {
    const id8 = patient.id.replace(/-/g, "").slice(0, 8);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ymd = localIsoDate(d).replaceAll("-", "");
    const hms = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return [
        `MeDoc-Akte-${id8}-${ymd}-${hms}.${ext}`,
        `Patientenakte-${id8}-${ymd}.${ext}`,
        `Akte-Export-${id8}-${ymd}T${hms}.${ext}`,
    ];
}

export type ChartExportSnapshot = {
    exportMeta: { generatedAt: string; app: string };
    patient: Patient;
    chart: PatientChart;
    dental_findings: DentalFinding[];
    anamnesis: { answers: string; signed: boolean } | null;
    examinations: Examination[];
    treatments: Treatment[];
    prescriptions: Prescription[];
    certificate: Certificate[];
    payments: Payment[];
    attachments: ChartAttachmentRowDto[];
};

export async function loadChartExportSnapshot(
    patientId: string,
    opts: { loadClinical: boolean },
): Promise<ChartExportSnapshot> {
    const patient = await getPatient(patientId);
    const chart = await getChart(patientId);
    const generatedAt = new Date().toISOString();

    const [prescriptions, certificate, attachments] = await Promise.all([
        opts.loadClinical ? listPrescriptions(patientId) : Promise.resolve([] as Prescription[]),
        opts.loadClinical ? listCertificates(patientId) : Promise.resolve([] as Certificate[]),
        listChartAttachments(chart.id),
    ]);

    let dental_findings: DentalFinding[] = [];
    let anamnesis: ChartExportSnapshot["anamnesis"] = null;
    let examinations: Examination[] = [];
    let treatments: Treatment[] = [];

    if (opts.loadClinical) {
        const [z, u, b, am] = await Promise.all([
            listDentalFindings(chart.id),
            listExaminations(chart.id),
            listTreatments(chart.id),
            getAnamnesisForm(patientId),
        ]);
        dental_findings = z;
        examinations = u;
        treatments = b;
        if (am) {
            anamnesis = { answers: am.answers, signed: am.signed };
        }
    }

    let payments: Payment[] = [];
    try {
        payments = await listPaymentsForPatient(patientId);
    } catch {
        payments = [];
    }

    return {
        exportMeta: { generatedAt, app: "MeDoc" },
        patient,
        chart,
        dental_findings,
        anamnesis,
        examinations,
        treatments,
        prescriptions,
        certificate,
        payments,
        attachments,
    };
}

export function filterSnapshotBySections(
    snap: ChartExportSnapshot,
    sec: ChartExportSectionsState,
): Record<string, unknown> {
    const o: Record<string, unknown> = { exportMeta: snap.exportMeta };
    if (sec.patient) o.patient = snap.patient;
    if (sec.chartCore) o.chart = snap.chart;
    if (sec.dental_findings) o.dental_findings = snap.dental_findings;
    if (sec.anamnesis) o.anamnesis = snap.anamnesis;
    if (sec.examinations) o.examinations = snap.examinations;
    if (sec.treatments) o.treatments = snap.treatments;
    if (sec.prescriptions) o.prescriptions = snap.prescriptions;
    if (sec.certificate) o.certificate = snap.certificate;
    if (sec.payments) o.payments = snap.payments;
    if (sec.attachments) o.attachments = snap.attachments;
    return o;
}

function newUuid(): string {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function mapGenderAdministrativeToFhir(g: string): string {
    // FHIR AdministrativeGender: male | female | other | unknown.
    // German "divers" maps to "other" (KBV Base profile uses the same mapping).
    switch ((g ?? "").toUpperCase()) {
        case "MALE":
            return "male";
        case "FEMALE":
            return "female";
        case "DIVERSE":
            return "other";
        default:
            return "unknown";
    }
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
            ...(p.phone ? [{ system: "phone", value: p.phone }] : []),
            ...(p.email ? [{ system: "email", value: p.email }] : []),
        ],
        gender: mapGenderAdministrativeToFhir(p.sex),
        birthDate: p.date_of_birth.slice(0, 10),
        address: p.address ? [{ text: p.address }] : [],
    };
}

function narrativeDivFromText(body: string): string {
    const parts = body.split("\n").map((p) => (p.trim() === "" ? "<br/>" : `<p>${escapeHtml(p)}</p>`));
    return `<div xmlns="http://www.w3.org/1999/xhtml">${parts.join("")}</div>`;
}

/**
 * FHIR R4 envelope: Bundle type=collection + Composition + Patient.
 * Informally matches HL7 document/collection pattern; not declared as validated IHE document.
 */
export function buildFhirInteropBundle(
    snap: ChartExportSnapshot,
    medocDomainPayload: Record<string, unknown>,
    sec: ChartExportSectionsState,
): Record<string, unknown> {
    const bundleId = newUuid();
    // In a Bundle, references must resolve against entry.fullUrl. Use urn:uuid
    // for both and reference the same URN (FHIR R4 Bundle §2.36.4.1).
    const compositionUuid = newUuid();
    const patientUuid = newUuid();
    const patientRef = `urn:uuid:${patientUuid}`;
    const patientIncluded = Boolean(sec.patient && medocDomainPayload.patient);
    const patient = patientIncluded ? toFhirPatientResource(snap.patient) : null;

    const sections: Record<string, unknown>[] = [];
    for (const row of CHART_EXPORT_SECTION_META) {
        if (!sec[row.key]) continue;
        const key = row.key === "chartCore" ? "chart" : row.key;
        const data = medocDomainPayload[key];
        if (data === undefined) continue;
        const json = JSON.stringify(data, null, 2);
        const title = chartExportSectionLabel(row.key, (key) =>
            translateLocale(useLocale.getState().locale, key),
        );
        sections.push({
            title,
            code: {
                coding: [
                    {
                        system: "urn:medoc:export-section",
                        code: row.key,
                        display: title,
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
        id: compositionUuid,
        meta: {
            profile: [`${CHART_EXPORT_PROFILE_URI}#composition`],
        },
        status: "final",
        type: {
            coding: [
                {
                    system: "http://loinc.org",
                    code: LOINC_SUMMARY_OF_EPISODE,
                    display: "Summary of episode note",
                },
            ],
            text: translateLocale(useLocale.getState().locale, "export.chart.fhir_text"),
        },
        subject: patientIncluded
            ? { reference: patientRef, display: snap.patient.name }
            : undefined,
        date: snap.exportMeta.generatedAt,
        // Composition.author is 1..*; a display-only reference is allowed.
        author: [{ display: `${snap.exportMeta.app} export` }],
        title: translateLocale(useLocale.getState().locale, "export.chart.fhir_title"),
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
        { fullUrl: `urn:uuid:${compositionUuid}`, resource: composition },
    ];
    if (patient && patientIncluded) {
        entry.push({
            fullUrl: patientRef,
            resource: { ...patient, id: patientUuid },
        });
    }

    return {
        resourceType: "Bundle",
        id: bundleId,
        meta: {
            profile: [CHART_EXPORT_PROFILE_URI],
            lastUpdated: snap.exportMeta.generatedAt,
        },
        // "document" requires Composition first + identifier + timestamp (bdl-9..11).
        // Only valid when the patient (Composition.subject) is included.
        type: patientIncluded ? "document" : "collection",
        identifier: { system: "urn:ietf:rfc:3986", value: `urn:uuid:${bundleId}` },
        timestamp: snap.exportMeta.generatedAt,
        entry,
    };
}

export function buildDocumentManifest(
    snap: ChartExportSnapshot,
    sec: ChartExportSectionsState,
): Record<string, unknown> {
    return {
        exportProfile: CHART_EXPORT_PROFILE_URI,
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
        standardsAlignment: CHART_EXPORT_STANDARDS_REFS,
        gdprNote:
            "Machine-readable JSON/XML/CSV sub-formats support common GDPR Art. 20 requirements (structured, commonly used, machine-readable). Scope and legal bases of the provided data must still be observed.",
    };
}

/** Full JSON export with interoperability wrapper + domain MeDoc payload. */
export function buildInteroperableChartJson(
    snap: ChartExportSnapshot,
    sec: ChartExportSectionsState,
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
export function buildChartExportXmlInterop(interop: Record<string, unknown>): string {
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<EhrExtract xmlns="urn:medoc:export:ehr:1.1" schemaVersion="1.1.0" ` +
            `note="Benennung informell angelehnt an ISO 13606-1 EHR_EXTRACT-Container; kein validiertes EN13606-Schema.">`,
        "  <DocumentManifest>",
    ];
    const dm = interop.documentManifest as Record<string, unknown> | undefined;
    if (dm) {
        lines.push(`    <ExportProfile>${escapeHtml(String(dm.exportProfile ?? ""))}</ExportProfile>`);
        lines.push(`    <SchemaVersion>${escapeHtml(String(dm.schemaVersion ?? ""))}</SchemaVersion>`);
        lines.push(`    <GeneratedAt>${escapeHtml(String(dm.generatedAt ?? ""))}</GeneratedAt>`);
        lines.push(`    <ConformanceDisclaimer>${escapeHtml(String(dm.conformanceDisclaimer ?? ""))}</ConformanceDisclaimer>`);
        lines.push(`    <GdprNote>${escapeHtml(String(dm.gdprNote ?? ""))}</GdprNote>`);
        const refs = dm.standardsAlignment as unknown[] | undefined;
        if (Array.isArray(refs)) {
            lines.push("    <StandardsAlignment>");
            for (const r of refs) {
                if (r && typeof r === "object") {
                    const o = r as Record<string, unknown>;
                    lines.push(
                        "      <Ref " +
                            `display="${escapeHtml(String(o.display ?? ""))}" ` +
                            `reference="${escapeHtml(String(o.reference ?? ""))}" />`,
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
        const inner = buildChartExportXml(dom).replace(/^<\?xml[^>]*>\n?/, "").replace(/^<PatientChartExport>/, "").replace(/<\/PatientChartExport>$/, "");
        lines.push(inner.split("\n").map((l) => (l ? `    ${l}` : "")).join("\n"));
    }
    lines.push("  </ClinicalRecordData>");
    lines.push("</EhrExtract>");
    return lines.join("\n");
}

/** CSV incl. meta lines (portability / norm notes) + flat domain section. */
export function buildChartExportCsvFromInterop(interop: Record<string, unknown>): string {
    const rows: string[][] = [
        ["Area", "Key", "Value"],
        ["Meta", "exportProfile", String((interop.documentManifest as { exportProfile?: string })?.exportProfile ?? "")],
        ["Meta", "schemaVersion", String((interop.documentManifest as { schemaVersion?: string })?.schemaVersion ?? "")],
        ["Meta", "fhirBundleTypeHint", "Bundle.type=collection (HL7 FHIR R4 informative)"],
        ["Meta", "compositionLoinc", LOINC_SUMMARY_OF_EPISODE],
    ];
    const dm = interop.documentManifest as { standardsAlignment?: { display?: string; reference?: string }[] } | undefined;
    if (dm?.standardsAlignment) {
        dm.standardsAlignment.forEach((r, i) => {
            rows.push(["Meta", `standardRef[${i}]`, `${r.display ?? ""} | ${r.reference ?? ""}`]);
        });
    }
    const dom = interop.medocDomainPayload as Record<string, unknown> | undefined;
    if (dom) {
        const rest = buildChartExportCsv(dom);
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

function xmlTagKey(k: string): string {
    const t = k.replace(/[^a-zA-Z0-9_-]/g, "_");
    return t.match(/^[A-Za-z_]/) ? t : `_${t}`;
}

/** Simple XML wrapper for structured Chart exports (machine readability). */
export function buildChartExportXml(data: Record<string, unknown>): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<PatientChartExport>"];
    const walk = (tag: string, val: unknown, indent: number): void => {
        const pad = "  ".repeat(indent);
        const safeTag = xmlTagKey(tag);
        if (val === null || val === undefined) {
            lines.push(`${pad}<${safeTag} />`);
            return;
        }
        if (typeof val === "object" && !Array.isArray(val)) {
            lines.push(`${pad}<${safeTag}>`);
            for (const [k, version] of Object.entries(val as Record<string, unknown>)) {
                walk(k, version, indent + 1);
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
        lines.push(`${pad}<${safeTag}>${escapeHtml(String(val))}</${safeTag}>`);
    };
    for (const [k, version] of Object.entries(data)) {
        walk(k, version, 1);
    }
    lines.push("</PatientChartExport>");
    return lines.join("\n");
}

/** CSV with `;` and header — flat rows (Bereich / key / Wert columns). */
export function buildChartExportCsv(data: Record<string, unknown>): string {
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
            for (const [k, version] of Object.entries(val as object)) {
                add("exportMeta", k, version);
            }
            continue;
        }
        if (Array.isArray(val)) {
            val.forEach((item, i) => {
                if (item && typeof item === "object") {
                    for (const [k, version] of Object.entries(item as object)) {
                        add(`${bereich}[${i}]`, k, version);
                    }
                } else {
                    add(bereich, String(i), item);
                }
            });
            continue;
        }
        if (val && typeof val === "object") {
            for (const [k, version] of Object.entries(val as object)) {
                add(bereich, k, version);
            }
            continue;
        }
        add(bereich, "", val);
    }

    const esc = (c: string): string => `"${c.replace(/"/g, '""')}"`;
    return rows.map((r) => r.map(esc).join(";")).join("\n");
}
