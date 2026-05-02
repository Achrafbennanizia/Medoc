import { getPatient } from "@/controllers/patient.controller";
import {
    getAkte,
    getAnamnesebogen,
    listAkteAnlagen,
    listBehandlungen,
    listUntersuchungen,
    listZahnbefunde,
} from "@/controllers/akte.controller";
import { listAtteste, type Attest } from "@/controllers/attest.controller";
import { listRezepte, type Rezept } from "@/controllers/rezept.controller";
import { listZahlungenForPatient } from "@/controllers/zahlung.controller";
import type { AkteAnlageRowDto } from "@/lib/akte-anlagen";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Untersuchung, Zahlung } from "@/models/types";

/**
 * Normative / de-facto Muster für Exporte (Informationsmodell, keine Zertifizierung):
 * – ISO 13606-1:2019 — EHR-Kommunikation, „EHR_EXTRACT“ als übergeordneter Kommunikationsrahmen
 *   (@see https://www.iso.org/standard/67868.html )
 * – HL7 FHIR R4 — Bundle (type collection/document) + Composition für dokumentenartige Zusammenstellung
 *   (@see https://www.hl7.org/fhir/R4/documents.html , https://www.hl7.org/fhir/R4/composition.html )
 * – EU-DSGVO Art. 20 — strukturierte, gängige, maschinenlesbare Formate (u. a. JSON, XML, CSV)
 *   (@see https://gdpr-info.eu/art-20-gdpr/ )
 * – ISO 22600:2014 — Privilegien-/Zugriffskontext spiegelt sich in den gefilterten Export-Daten wider
 *   (Praxis: RBAC bei Erstellung)
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
    /** Nur mit audit.read */
    audit: boolean;
};

export const AKTE_EXPORT_SECTION_META: {
    key: keyof AkteExportSectionsState;
    label: string;
    needsMedical: boolean;
    needsFinanzen?: boolean;
    needsAuditRead?: boolean;
}[] = [
    { key: "patient", label: "Stammdaten", needsMedical: false },
    { key: "akteCore", label: "Patientenakte (Status, Diagnose, Befunde)", needsMedical: false },
    { key: "anamnese", label: "Anamnese", needsMedical: true },
    { key: "behandlungen", label: "Behandlungen", needsMedical: true },
    { key: "untersuchungen", label: "Untersuchungen", needsMedical: true },
    { key: "zahnbefunde", label: "Zahnbefunde", needsMedical: true },
    { key: "rezepte", label: "Rezepte", needsMedical: true },
    { key: "attest", label: "Atteste", needsMedical: true },
    { key: "anlagen", label: "Anlagen", needsMedical: false },
    { key: "zahlungen", label: "Zahlungen", needsMedical: false, needsFinanzen: true },
    { key: "audit", label: "Audit-Auszug", needsMedical: false, needsAuditRead: true },
];

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

/** Vorschläge: zuerst ISO-ähnlich eindeutig, dann lesbar. */
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

/** Teilmenge FHIR R4 Patient — nur für Interoperabilitätshülle (kein vollständiges Validierungsprofil). */
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
 * Entspricht dem in HL7 beschriebenen Dokument-/Sammelmuster informell; nicht als validiertes IHE-Dokument deklariert.
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
        language: "de-DE",
        rbacFilteredSections: sec,
        conformanceDisclaimer:
            "Mapping nach FHIR R4 und ISO-13606-orientiertem Extract-Muster ist informativ; dies ist kein zertifizierter HL7- oder EN-13606-Export.",
        standardsAlignment: AKTE_EXPORT_STANDARDS_REFS,
        gdprNote:
            "Maschinenlesbare JSON/XML/CSV-Unterformate unterstützen gängige Anforderungen aus DSGVO Art. 20 (strukturiert, verbreitet, maschinenlesbar). Umfang und Rechtsgrundlagen der bereitgestellten Daten sind weiterhin zu beachten.",
    };
}

/** Vollständiger JSON-Export mit Interoperabilitätshülle + fachlichem MeDoc-Payload. */
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

/** ISO-13606-/openEHR-inspirierte XML-Hülle + eingebettetes FHIR-JSON + klinischer Domain-Baum. */
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

/** CSV inkl. Metazeilen (Portabilität / Normhinweise) + flacher Domain-Teil. */
export function buildAkteExportCsvFromInterop(interop: Record<string, unknown>): string {
    const rows: string[][] = [
        ["Bereich", "Schlüssel", "Wert"],
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

/** Minimal CSV-Zeilenparser für zusammengefügte Exporte (Semikolon, Anführungszeichen). */
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

/** Einfache XML-Hülle für strukturierte Akten-Exports (Maschinenlesbarkeit). */
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

/** CSV mit `;` und Kopfzeile — flache Zeilen („Bereich“, „Schlüssel“, „Wert“). */
export function buildAkteExportCsv(data: Record<string, unknown>): string {
    const rows: string[][] = [["Bereich", "Schlüssel", "Wert"]];

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
