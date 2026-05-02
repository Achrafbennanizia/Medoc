import { useCallback, useEffect, useId, useMemo, useRef, useState, Fragment, type ReactNode } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { deletePatient, getPatient, updatePatient } from "../../controllers/patient.controller";
import {
    getAkte,
    listZahnbefunde,
    createZahnbefund,
    getAnamnesebogen,
    saveAnamnesebogen,
    listBehandlungen,
    listUntersuchungen,
    createBehandlung,
    createUntersuchung,
    updateBehandlung,
    deleteBehandlung,
    updateUntersuchung,
    deleteUntersuchung,
    listAkteAnlagen,
    createAkteAnlage,
    deleteAkteAnlage,
    renameAkteAnlage,
    openAkteAnlageExternally,
    duplicateAkteAnlage,
} from "../../controllers/akte.controller";
import { listBehandlungsKatalog, listDokumentVorlagen, createDokumentVorlage } from "../../controllers/praxis.controller";
import { formatCurrency, formatDate, formatDateTime } from "../../lib/utils";
import { allowed, parseRole } from "../../lib/rbac";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Untersuchung, BehandlungsKatalogItem, DokumentVorlage } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Card, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading } from "../components/ui/page-status";
import { DentalMiniBar } from "../components/DentalMiniBar";
import { AnamneseVisual } from "../components/AnamneseVisual";
import {
    EMPTY_ANAMNESE_V1_JSON,
    mergeQuickIntoAnamneseJson,
    parseAnamneseV1,
} from "@/lib/anamnese";
import { UntersuchungComposer } from "../components/UntersuchungComposer";
import { parseUntersuchungV1, previewNextUntersuchungsnummer } from "@/lib/untersuchung";
import { CalendarIcon, ChevronLeftIcon, EditIcon, ExportIcon, MailIcon, PhoneIcon, PlusIcon, ShieldCheckIcon } from "@/lib/icons";
import { FormSection } from "../components/ui/form-section";
import { EmptyState } from "../components/ui/empty-state";
import { AkteAnlagenPanel } from "../components/akte-anlagen-panel";
import { AkteEditFormOrInline, AkteInlineEditPanelShell, ConfirmOrInline } from "../components/akte-confirm-presentation";
import { BehandlungAkteComposerPanel, type BehandlungAkteComposerPanelProps } from "../components/behandlung-akte-composer-panel";
import { ConfirmDialog } from "../components/ui/dialog";
import { ExportPickerDialog, HtmlDocumentExportPickerDialog, type HtmlExportDocumentKind } from "../components/export-picker-dialog";
import {
    SECTION_LABEL as VAL_SECTION_LABEL,
    itemValidationKey,
    type ValidationRecord,
    type ValidationSection,
    type ValidationState,
} from "@/lib/akte-validation";
import {
    clearAkteValidation,
    listAkteValidation,
    migrateLegacyAkteValidationFromLocalStorage,
    rowsToValidationMaps,
    setAkteItemValidated,
    setAkteSectionValidated,
} from "@/controllers/validation.controller";
import { listRezepte, deleteRezept, createRezept, updateRezept, type Rezept } from "@/controllers/rezept.controller";
import { listAtteste, createAttest, deleteAttest, type Attest } from "@/controllers/attest.controller";
import { listZahlungenForPatient, createZahlung, updateZahlung, deleteZahlung } from "@/controllers/zahlung.controller";
import type { Zahlung, ZahlungsArt } from "@/models/types";
import {
    emptyPlanNextTermin,
    planNextHasContent,
    type PlanNextTerminV2,
} from "@/lib/plan-next-termin";
import { loadPlanNextTerminWithMigration, persistPlanNextTerminToBackend } from "@/controllers/plan-next-termin.controller";
import {
    emptyRezeptLine,
    MEDIKAMENT_SUGGESTIONS,
    findSuggestion,
    parseRezeptVorlagePayload,
    vorlageItemsToLines,
    rezeptLinesToVorlageItems,
    type RezeptLine,
} from "@/lib/medikamente";
import {
    ATTEST_TYP_OPTIONS,
    KRANKHEITEN_SUGGESTIONS,
    attestGueltigBisFromVonAndTage,
    buildAttestInhalt,
    emptyAttestComposerForm,
    parseAttestVorlagePayload,
    validateAttestComposer,
    type AttestComposerFormFields,
} from "@/lib/attest-composer";
import {
    validateAnlageFile,
    mapAkteAnlageRowDto,
    fileToBase64ForAnlage,
    deriveAnlageDisplayName,
    type AkteAnlage,
} from "@/lib/akte-anlagen";
import { loadClientSettings } from "@/lib/client-settings";
import { resolveOpenImageWithAppPath } from "@/lib/photo-viewer-apps";
import { clearPatientScopedBrowserStorage } from "@/lib/patient-browser-storage";
import {
    bundleAttestExport,
    bundleQuittungExport,
    bundleRezeptExport,
    suggestAttestExportBasename,
    suggestQuittungExportBasename,
    suggestRezeptExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import {
    ZAHLUNG_ART_SELECT,
    ZAHL_EUR_EPS,
    aggregateZahlungenByZuordnung,
    buildOpenZahlLinkSelectOptions,
    formatZahlungBezugLine,
    maxEditZahlungBehandlung,
    maxNeuZahlungBehandlung,
    roundMoney2,
    sumZahlungenForBehandlung,
    sumZahlungenForUntersuchung,
    zahlCountsTowardPaid,
    zahlHistoryForBehandlung,
    zahlHistoryForUntersuchung,
    latestZahlungForZuordnungRow,
    zahlStatusDisplay,
    zahlungsartLabel,
    type ZahlZuordnungSummaryRow,
} from "@/lib/zahlung-buchung";

function validateRezeptLine(line: RezeptLine): string | null {
    if (!line.medikament.trim()) return "Bitte Medikament angeben.";
    if (!line.dosierung.trim()) return "Bitte Dosierung angeben.";
    if (!line.dauer.trim()) return "Bitte Dauer angeben.";
    return null;
}

function isPatientenakteMissingError(e: unknown): boolean {
    const m = e instanceof Error ? e.message : String(e);
    return m.includes("Patientenakte nicht gefunden") || /Patientenakte.*?nicht gefunden/i.test(m);
}

const TAB_IDS = ["stamm", "anam", "unter", "behand", "rezept", "anlage", "zahl"] as const;
type AkteTab = (typeof TAB_IDS)[number];

type RezeptWizardStep = null | "pick" | "compose" | "ask_vorlage" | "name_vorlage";
type AttestWizardStep = null | "pick" | "compose" | "ask_vorlage" | "name_vorlage";

/** Bestätigung nur für sensible Aktionen (Vorlage + Rezepte, Anlagen). Normale Speicherungen: Toast + optional Rückgängig. */
type AkteSavePending =
    | { kind: "rezept_finalize_vorlage"; titel: string; lines: RezeptLine[]; shared: string }
    | { kind: "attest_finalize_vorlage"; titel: string; fields: AttestComposerFormFields }
    | { kind: "anlage_add"; file: File }
    | { kind: "anlage_remove"; id: string; name: string };

const TOAST_UNDO_MS = 5200;

function akteSaveConfirmUi(p: AkteSavePending): { title: string; message: string; confirmLabel: string } {
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

function tabFromHash(hash: string): AkteTab | null {
    const h = hash.replace(/^#/, "");
    return TAB_IDS.includes(h as AkteTab) ? (h as AkteTab) : null;
}

function rezeptStatusDisplay(status: string): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    if (s === "AUSGESTELLT") return { variant: "success", label: "Ausgestellt" };
    if (s === "ENTWURF") return { variant: "warning", label: "Entwurf" };
    return { variant: "default", label: s || "—" };
}

function resolveKatalogIdForBehandlung(katalog: BehandlungsKatalogItem[], b: Behandlung): string {
    const name = (b.leistungsname || b.beschreibung || "").trim();
    if (!name) return "";
    const exact = katalog.find((k) => k.name === name);
    if (exact) return exact.id;
    const sub = katalog.find((k) => name.includes(k.name) || k.name.includes(name));
    return sub?.id ?? "";
}

function behandlungToUpdatePayload(b: Behandlung) {
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

function behandlungContinueLabel(b: Behandlung): string {
    const bn = (b.behandlungsnummer ?? "").trim() || "—";
    const sitz = b.sitzung != null ? String(b.sitzung) : "?";
    const titel = b.leistungsname || b.beschreibung || b.art;
    const d = b.behandlung_datum ? formatDate(b.behandlung_datum) : formatDateTime(b.created_at);
    return `${bn} · Sitzung ${sitz} · ${titel} · ${d}`;
}

function alterAusGeburtsdatum(geburtsdatum: string): number | null {
    const raw = geburtsdatum.slice(0, 10);
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a -= 1;
    return Math.max(0, a);
}

export function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const detailQuery = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const fromTerminCreate = detailQuery.get("from") === "termin-create";
    const draft = detailQuery.get("draft") ?? "";
    const terminBackLink = fromTerminCreate && draft
        ? `/termine/neu?patient_id=${encodeURIComponent(id ?? "")}&draft=${encodeURIComponent(draft)}`
        : `/termine/neu?patient_id=${encodeURIComponent(id ?? "")}`;
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canViewClinical = role != null && allowed("patient.read_medical", role);
    const canListBehandlungenForZahlung = role != null && allowed("patient.behandlungen_list_for_zahlung", role);
    const canWriteMedical = role != null && allowed("patient.write_medical", role);
    const canReadFinanzen = role != null && allowed("finanzen.read", role);
    const canAuditRead = role != null && allowed("audit.read", role);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [patientLoadError, setPatientLoadError] = useState<string | null>(null);
    const [akteLoadError, setAkteLoadError] = useState<string | null>(null);
    const [akte, setAkte] = useState<Patientenakte | null>(null);
    const [befunde, setBefunde] = useState<Zahnbefund[]>([]);
    const [behandlungen, setBehandlungen] = useState<Behandlung[]>([]);
    const [untersuchungen, setUntersuchungen] = useState<Untersuchung[]>([]);
    const [anamneseJson, setAnamneseJson] = useState("");
    const [anamneseSign, setAnamneseSign] = useState(false);
    const [showUnterComposer, setShowUnterComposer] = useState(false);
    const [showBehandComposer, setShowBehandComposer] = useState(false);
    const [akteExportPickerOpen, setAkteExportPickerOpen] = useState(false);
    const [htmlDocExport, setHtmlDocExport] = useState<{
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    } | null>(null);
    const [katalog, setKatalog] = useState<BehandlungsKatalogItem[]>([]);
    const [selectedBehandTooth, setSelectedBehandTooth] = useState<string | null>(null);
    /** Anamnese: zuerst nur lesen, Felder nach „Bearbeiten“ freischalten. */
    const [anamEditing, setAnamEditing] = useState(false);
    const [anamQuick, setAnamQuick] = useState({
        versicherungsstatus: "",
        krankenkasse: "",
        chronisch: "",
        allergienMed: "",
    });
    const [behandForm, setBehandForm] = useState({
        datum: new Date().toISOString().slice(0, 10),
        kategorie: "",
        leistungsname: "",
        leistungKatalogId: "",
        behandlungsnummer: "",
        sitzung: "",
        gesamtkosten: "",
        behandlung_status: "DURCHGEFUEHRT",
        termin_erforderlich: "0",
        notizen: "",
    });
    const [untersuchungForm, setUntersuchungForm] = useState({
        beschwerden: "", ergebnisse: "", diagnose: "",
    });
    /** Aufgeklappter Untersuchungs-Eintrag (zeigt strukturierte Detailansicht). */
    const [unterDetailId, setUnterDetailId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AkteTab>("stamm");
    const [rezeptDeleteId, setRezeptDeleteId] = useState<string | null>(null);
    const [rezepte, setRezepte] = useState<Rezept[]>([]);
    /** Unteransicht auf dem Tab „Rezepte & Atteste“. */
    const [rezeptAttestSub, setRezeptAttestSub] = useState<"rezept" | "attest">("rezept");
    const [atteste, setAtteste] = useState<Attest[]>([]);
    const [attestDeleteId, setAttestDeleteId] = useState<string | null>(null);
    const [attestVorlagen, setAttestVorlagen] = useState<DokumentVorlage[]>([]);
    const [attestWizardStep, setAttestWizardStep] = useState<AttestWizardStep>(null);
    const attestWizardPanelRef = useRef<HTMLDivElement>(null);
    const [attestComposerKind, setAttestComposerKind] = useState<"vorlage" | "neu">("neu");
    const [attestForm, setAttestForm] = useState<AttestComposerFormFields>(() =>
        emptyAttestComposerForm(new Date().toISOString().slice(0, 10)));
    const [attestBaselineJson, setAttestBaselineJson] = useState<string | null>(null);
    const [attestComposerBusy, setAttestComposerBusy] = useState(false);
    const [attestDraftErr, setAttestDraftErr] = useState<string | null>(null);
    const [attestPickQuery, setAttestPickQuery] = useState("");
    const [attestPickSelectedId, setAttestPickSelectedId] = useState("");
    const [attestNewVorlageTitel, setAttestNewVorlageTitel] = useState("");
    const [attestPendingQueue, setAttestPendingQueue] = useState<AttestComposerFormFields | null>(null);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [anlagen, setAnlagen] = useState<AkteAnlage[]>([]);
    const anlagenRef = useRef<AkteAnlage[]>([]);
    const anlageFileInputId = useId();
    const anlageCameraInputId = useId();
    const [showEditPatient, setShowEditPatient] = useState(false);
    const [akteSaveConfirm, setAkteSaveConfirm] = useState<AkteSavePending | null>(null);
    const [akteSaveBusy, setAkteSaveBusy] = useState(false);
    /** Wenn Speichern über ein Popup läuft (z. B. Untersuchung), hier den Composer entblocken. */
    const [patientDeleteOpen, setPatientDeleteOpen] = useState(false);
    const [patientDeleteBusy, setPatientDeleteBusy] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", telefon: "", email: "", adresse: "" });
    const [validation, setValidation] = useState<ValidationState>({});
    const [itemValidation, setItemValidation] = useState<Partial<Record<string, ValidationRecord>>>({});
    /** Arzt → Rezeption: strukturierter Terminplan (localStorage v2). */
    const [showPlanTip, setShowPlanTip] = useState(false);
    const [planNext, setPlanNext] = useState<PlanNextTerminV2>(emptyPlanNextTermin);
    const [behandComposerMode, setBehandComposerMode] = useState<"new" | "continue" | null>(null);
    const [continueFromBehandlungId, setContinueFromBehandlungId] = useState<string>("");
    const [behandEditId, setBehandEditId] = useState<string | null>(null);
    /** Beim Bearbeiten einer Zeile: zuerst Ansicht (gesperrt), dann „Bearbeiten“. Neu/Fortsetzen: sofort frei. */
    const [behandFormUnlocked, setBehandFormUnlocked] = useState(true);
    const [behandDeleteId, setBehandDeleteId] = useState<string | null>(null);
    const [unterEdit, setUnterEdit] = useState<Untersuchung | null>(null);
    const [unterEditUnlocked, setUnterEditUnlocked] = useState(false);
    const [unterDeleteId, setUnterDeleteId] = useState<string | null>(null);
    const [zahlEdit, setZahlEdit] = useState<Zahlung | null>(null);
    const [zahlEditUnlocked, setZahlEditUnlocked] = useState(false);
    const [zahlDeleteId, setZahlDeleteId] = useState<string | null>(null);
    const [zahlEditForm, setZahlEditForm] = useState({
        betrag: "",
        zahlungsart: "BAR" as ZahlungsArt,
        beschreibung: "",
    });
    const [showZahlComposer, setShowZahlComposer] = useState(false);
    const [zahlNewForm, setZahlNewForm] = useState({
        linkKind: "" as "" | "behand" | "unter",
        linkId: "",
        betrag: "",
        zahlungsart: "BAR" as ZahlungsArt,
        beschreibung: "",
    });
    const [zahlListenModus, setZahlListenModus] = useState<"summe" | "historie">("summe");

    const [rezeptVorlagen, setRezeptVorlagen] = useState<DokumentVorlage[]>([]);
    const [rezeptPickQuery, setRezeptPickQuery] = useState("");
    const [rezeptPickSelectedId, setRezeptPickSelectedId] = useState("");
    const [rezeptWizardStep, setRezeptWizardStep] = useState<RezeptWizardStep>(null);
    const rezeptWizardPanelRef = useRef<HTMLDivElement>(null);

    const [rezeptComposerKind, setRezeptComposerKind] = useState<"vorlage" | "neu">("neu");
    const [rezeptLines, setRezeptLines] = useState<RezeptLine[]>([]);
    const [rezeptDraft, setRezeptDraft] = useState<RezeptLine>(() => emptyRezeptLine());
    const [rezeptSharedNotes, setRezeptSharedNotes] = useState("");
    const [rezeptBaselineJson, setRezeptBaselineJson] = useState<string | null>(null);
    const [rezeptDraftErr, setRezeptDraftErr] = useState<string | null>(null);
    const [rezeptComposerBusy, setRezeptComposerBusy] = useState(false);

    const [rezeptNewVorlageTitel, setRezeptNewVorlageTitel] = useState("");
    const [rezeptPendingQueue, setRezeptPendingQueue] = useState<{ lines: RezeptLine[]; shared: string } | null>(null);

    const [rezeptEdit, setRezeptEdit] = useState<Rezept | null>(null);
    const [rezeptEditUnlocked, setRezeptEditUnlocked] = useState(false);
    const [rezeptEditForm, setRezeptEditForm] = useState({
        medikament: "",
        wirkstoff: "",
        dosierung: "",
        dauer: "",
        hinweise: "",
    });

    const toast = useToastStore((s) => s.add);
    const canFinanzenWrite = (() => {
        const r = parseRole(session?.rolle);
        return r ? allowed("finanzen.write", r) : false;
    })();

    const refreshValidationFromBackend = useCallback(async () => {
        if (!id) return;
        const rows = await listAkteValidation(id);
        const { sections, items } = rowsToValidationMaps(rows);
        setValidation(sections);
        setItemValidation(items);
    }, [id]);

    /* Errors use store getter so `toast` need not be a dependency (avoids unnecessary effect reruns). */
    useEffect(() => {
        if (!id) return;
        void (async () => {
            try {
                await migrateLegacyAkteValidationFromLocalStorage(id);
                await refreshValidationFromBackend();
            } catch (e) {
                useToastStore.getState().add(
                    `Validierung laden: ${e instanceof Error ? e.message : String(e)}`,
                    "error",
                );
            }
        })();
    }, [id, refreshValidationFromBackend]);

    useEffect(() => {
        if (!id) return;
        void loadPlanNextTerminWithMigration(id)
            .then(setPlanNext)
            .catch(() => setPlanNext(emptyPlanNextTermin()));
    }, [id]);

    useEffect(() => {
        anlagenRef.current = anlagen;
    }, [anlagen]);

    /** Mark a section validated; informs the user via toast. */
    const validateSection = useCallback(
        async (section: ValidationSection) => {
            if (!id) return;
            const by = session?.user_id ?? null;
            try {
                if (section === "stamm") {
                    await setAkteSectionValidated(id, "stamm", by);
                    await setAkteSectionValidated(id, "anam", by);
                    toast("Stammdaten und Anamnese als geprüft markiert.", "success");
                } else {
                    await setAkteSectionValidated(id, section, by);
                    toast(`„${VAL_SECTION_LABEL[section]}“ als geprüft markiert.`, "success");
                }
                await refreshValidationFromBackend();
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [id, session, toast, refreshValidationFromBackend],
    );

    const revokeSectionValidation = useCallback(
        async (section: ValidationSection) => {
            if (!id) return;
            try {
                if (section === "stamm") {
                    await clearAkteValidation(id, "stamm");
                    await clearAkteValidation(id, "anam");
                    toast("Validierung für Stammdaten und Anamnese zurückgesetzt.", "info");
                } else {
                    await clearAkteValidation(id, section);
                    toast(`Validierung für „${VAL_SECTION_LABEL[section]}“ zurückgesetzt.`, "info");
                }
                await refreshValidationFromBackend();
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [id, toast, refreshValidationFromBackend],
    );

    const requestValidateItem = useCallback(
        async (itemKey: string, label: string) => {
            if (!id) return;
            try {
                await setAkteItemValidated(id, itemKey, session?.user_id ?? null);
                await refreshValidationFromBackend();
                toast(`„${label}“ als geprüft markiert.`, "success");
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [id, session, toast, refreshValidationFromBackend],
    );

    const revokeItemValidationRow = useCallback(
        async (itemKey: string, shortLabel: string) => {
            if (!id) return;
            try {
                await clearAkteValidation(id, itemKey);
                await refreshValidationFromBackend();
                toast(`Validierung für „${shortLabel}“ zurückgesetzt.`, "info");
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [id, toast, refreshValidationFromBackend],
    );

    const persistPlanNext = useCallback(
        (next: PlanNextTerminV2) => {
            setPlanNext(next);
            if (id) {
                void persistPlanNextTerminToBackend(id, next).catch((e) => {
                    toast(`Termin-Hinweis speichern: ${e instanceof Error ? e.message : String(e)}`, "error");
                });
            }
        },
        [id, toast],
    );

    useEffect(() => {
        const fromUrl = tabFromHash(location.hash);
        if (!fromUrl) return;
        const needsClinical = fromUrl === "anam" || fromUrl === "unter" || fromUrl === "behand";
        if (needsClinical && !canViewClinical) {
            setActiveTab("stamm");
            navigate({ pathname: location.pathname, search: location.search, hash: "stamm" }, { replace: true });
            return;
        }
        setActiveTab(fromUrl);
    }, [location.hash, canViewClinical, navigate, location.pathname, location.search]);

    const goTab = (tab: AkteTab) => {
        setActiveTab(tab);
        navigate({ pathname: location.pathname, search: location.search, hash: tab }, { replace: true });
    };

    const refreshAnlagen = useCallback(async (akteId: string) => {
        try {
            const rows = await listAkteAnlagen(akteId);
            setAnlagen(rows.map(mapAkteAnlageRowDto));
        } catch {
            setAnlagen([]);
        }
    }, []);

    const load = useCallback(async () => {
        if (!id) return;
        setPatientLoadError(null);
        setAkteLoadError(null);
        try {
            const p = await getPatient(id);
            setPatient(p);
            setEditForm({ name: p.name, telefon: p.telefon ?? "", email: p.email ?? "", adresse: p.adresse ?? "" });
        } catch (e) {
            setPatient(null);
            setPatientLoadError(e instanceof Error ? e.message : String(e));
            setAkte(null);
            setBefunde([]);
            setBehandlungen([]);
            setUntersuchungen([]);
            setKatalog([]);
            return;
        }
        setBefunde([]);
        setBehandlungen([]);
        setUntersuchungen([]);
        setKatalog([]);
        setRezepte([]);
        setAtteste([]);
        setZahlungen([]);
        setAnamneseJson("");
        setAnamneseSign(false);
        try {
            const a = await getAkte(id);
            setAkte(a);
            void refreshAnlagen(a.id);
            const [rez, zPat, att, katRows] = await Promise.all([
                listRezepte(id),
                listZahlungenForPatient(id),
                listAtteste(id),
                listBehandlungsKatalog().catch(() => [] as BehandlungsKatalogItem[]),
            ]);
            setRezepte(rez);
            setZahlungen(zPat);
            setAtteste(att);
            setKatalog(katRows);
            if (canViewClinical) {
                const [z, bh, u, am] = await Promise.all([
                    listZahnbefunde(a.id),
                    listBehandlungen(a.id),
                    listUntersuchungen(a.id),
                    getAnamnesebogen(id),
                ]);
                setBefunde(z);
                setBehandlungen(bh);
                setUntersuchungen(u);
                if (am) {
                    try {
                        setAnamneseJson(JSON.stringify(JSON.parse(am.antworten), null, 2));
                    } catch {
                        setAnamneseJson(am.antworten);
                    }
                    setAnamneseSign(am.unterschrieben);
                } else {
                    setAnamneseJson(EMPTY_ANAMNESE_V1_JSON);
                    setAnamneseSign(false);
                }
            } else if (canListBehandlungenForZahlung) {
                const [bh, u] = await Promise.all([listBehandlungen(a.id), listUntersuchungen(a.id)]);
                setBehandlungen(bh);
                setUntersuchungen(u);
            }
        } catch (e) {
            setAkte(null);
            setBefunde([]);
            setBehandlungen([]);
            setUntersuchungen([]);
            setKatalog([]);
            setAnlagen([]);
            if (isPatientenakteMissingError(e)) {
                setAkteLoadError(null);
            } else {
                setAkteLoadError(e instanceof Error ? e.message : String(e));
            }
        }
    }, [id, canViewClinical, canListBehandlungenForZahlung, refreshAnlagen]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => () => {
        for (const a of anlagenRef.current) {
            if (a.previewUrl.startsWith("blob:")) {
                try {
                    URL.revokeObjectURL(a.previewUrl);
                } catch {
                    /* ignore */
                }
            }
        }
    }, []);

    /* Unlock state only when switching to another row id, not on every field mutation. */
    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (unterEdit) setUnterEditUnlocked(false);
    }, [unterEdit?.id]);

    useEffect(() => {
        if (rezeptEdit) setRezeptEditUnlocked(false);
    }, [rezeptEdit?.id]);

    useEffect(() => {
        if (zahlEdit) setZahlEditUnlocked(false);
    }, [zahlEdit?.id]);
    /* eslint-enable react-hooks/exhaustive-deps */

    useEffect(() => {
        if (!id) return;
        const v =
            zahlNewForm.linkKind && zahlNewForm.linkId
                ? `${zahlNewForm.linkKind}:${zahlNewForm.linkId}`
                : "";
        if (!v) return;
        const openOpts = buildOpenZahlLinkSelectOptions(zahlungen, id, behandlungen, untersuchungen);
        if (!openOpts.some((o) => o.value === v)) {
            setZahlNewForm((p) => ({ ...p, linkKind: "", linkId: "" }));
        }
    }, [id, zahlungen, behandlungen, untersuchungen, zahlNewForm.linkKind, zahlNewForm.linkId]);

    useEffect(() => {
        setAnlagen((prev) => {
            for (const a of prev) {
                if (a.previewUrl.startsWith("blob:")) {
                    try {
                        URL.revokeObjectURL(a.previewUrl);
                    } catch {
                        /* ignore */
                    }
                }
            }
            return [];
        });
    }, [id]);

    useEffect(() => {
        if (activeTab !== "anam") return;
        const p = parseAnamneseV1(anamneseJson);
        const next = {
            versicherungsstatus: p?.versicherungsstatus ?? "",
            krankenkasse: p?.krankenkasse ?? "",
            chronisch: p?.vorerkrankungen?.chronisch ?? "",
            allergienMed: p?.allergien?.medikamente ?? "",
        };
        setAnamQuick((prev) =>
            prev.versicherungsstatus === next.versicherungsstatus &&
            prev.krankenkasse === next.krankenkasse &&
            prev.chronisch === next.chronisch &&
            prev.allergienMed === next.allergienMed
                ? prev
                : next,
        );
    }, [activeTab, id, anamneseJson]);

    useEffect(() => {
        if (activeTab !== "anam") setAnamEditing(false);
    }, [activeTab]);

    const runSavePatient = async () => {
        if (!id || !patient || !editForm.name.trim()) return;
        const prev = {
            name: patient.name,
            telefon: patient.telefon ?? "",
            email: patient.email ?? "",
            adresse: patient.adresse ?? "",
        };
        try {
            await updatePatient(id, {
                name: editForm.name,
                telefon: editForm.telefon || null,
                email: editForm.email || null,
                adresse: editForm.adresse || null,
            });
            toast("Patient gespeichert", "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updatePatient(id, {
                            name: prev.name,
                            telefon: prev.telefon || null,
                            email: prev.email || null,
                            adresse: prev.adresse || null,
                        });
                        await load();
                    } catch (err) {
                        toast(`Fehler: ${err instanceof Error ? err.message : String(err)}`, "error");
                    }
                },
            });
            setShowEditPatient(false);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const persistBehandlungAfterConfirm = async () => {
        if (!akte) return;
        const bn = behandForm.behandlungsnummer.trim();
        let sitzungNum: number | null = null;
        if (behandForm.sitzung.trim()) {
            const n = Number(behandForm.sitzung);
            sitzungNum = Number.isFinite(n) ? n : null;
        } else if (bn) {
            const same = behandlungen.filter((b) => (b.behandlungsnummer ?? "").trim() === bn);
            const maxS = same.reduce((acc, b) => Math.max(acc, b.sitzung ?? 0), 0);
            sitzungNum = maxS + 1;
        }
        const gRaw = behandForm.gesamtkosten.trim().replace(",", ".");
        const g = gRaw === "" ? NaN : Number(gRaw);
        const payload = {
            art: behandForm.leistungsname.trim(),
            beschreibung: behandForm.leistungsname.trim(),
            zaehne: selectedBehandTooth,
            material: null as string | null,
            notizen: behandForm.notizen.trim() || null,
            kategorie: behandForm.kategorie.trim(),
            leistungsname: behandForm.leistungsname.trim(),
            behandlungsnummer: bn || null,
            sitzung: sitzungNum,
            behandlung_status: behandForm.behandlung_status || null,
            gesamtkosten: Number.isFinite(g) ? g : null,
            termin_erforderlich: behandForm.termin_erforderlich === "1",
            behandlung_datum: behandForm.datum.trim() || null,
        };
        const prevBh = behandEditId ? behandlungen.find((b) => b.id === behandEditId) ?? null : null;
        try {
            if (behandEditId) {
                await updateBehandlung({ id: behandEditId, ...payload });
                toast("Behandlung aktualisiert", "success", {
                    durationMs: TOAST_UNDO_MS,
                    onUndo: async () => {
                        if (!prevBh) return;
                        try {
                            await updateBehandlung(behandlungToUpdatePayload(prevBh));
                            await load();
                        } catch (err) {
                            toast(`Fehler: ${err instanceof Error ? err.message : String(err)}`, "error");
                        }
                    },
                });
                setBehandEditId(null);
            } else {
                const created = await createBehandlung({ akte_id: akte.id, ...payload });
                toast("Behandlung dokumentiert", "success", {
                    durationMs: TOAST_UNDO_MS,
                    onUndo: async () => {
                        try {
                            await deleteBehandlung(created.id);
                            await load();
                        } catch (err) {
                            toast(`Fehler: ${err instanceof Error ? err.message : String(err)}`, "error");
                        }
                    },
                });
            }
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
            return;
        }
        setBehandForm({
            datum: new Date().toISOString().slice(0, 10),
            kategorie: "",
            leistungsname: "",
            leistungKatalogId: "",
            behandlungsnummer: "",
            sitzung: "",
            gesamtkosten: "",
            behandlung_status: "DURCHGEFUEHRT",
            termin_erforderlich: "0",
            notizen: "",
        });
        setSelectedBehandTooth(null);
        setShowBehandComposer(false);
        setBehandComposerMode(null);
        setContinueFromBehandlungId("");
        setBehandFormUnlocked(true);
        await load();
    };

    const runSaveBehandlung = () => {
        if (!akte) return;
        if (behandEditId && !behandFormUnlocked) {
            toast("Zum Bearbeiten zuerst „Bearbeiten“ wählen.", "info");
            return;
        }
        if (!behandForm.kategorie.trim() || !behandForm.leistungsname.trim()) {
            toast("Kategorie und Leistungsname auswählen oder eintragen.", "error");
            return;
        }
        void persistBehandlungAfterConfirm();
    };

    const persistUntersuchungCreate = async (data: { beschwerden: string; diagnose: string; ergebnisseJson: string }) => {
        if (!akte) return;
        try {
            const created = await createUntersuchung({
                akte_id: akte.id,
                beschwerden: data.beschwerden.trim() || null,
                ergebnisse: data.ergebnisseJson.trim() || null,
                diagnose: data.diagnose.trim() || null,
            });
            toast("Untersuchung erfasst", "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteUntersuchung(created.id);
                        await load();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            setShowUnterComposer(false);
            setUntersuchungForm({ beschwerden: "", ergebnisse: "", diagnose: "" });
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleCreateUntersuchung = async (payload?: { beschwerden: string; diagnose: string; ergebnisseJson: string }) => {
        const data = payload ?? {
            beschwerden: untersuchungForm.beschwerden,
            diagnose: untersuchungForm.diagnose,
            ergebnisseJson: untersuchungForm.ergebnisse,
        };
        await persistUntersuchungCreate(data);
    };

    const runSaveUntersuchungEdit = async (payload: { beschwerden: string; diagnose: string; ergebnisseJson: string }) => {
        if (!unterEdit) return;
        const uid = unterEdit.id;
        const prevSnap = {
            beschwerden: unterEdit.beschwerden,
            diagnose: unterEdit.diagnose,
            ergebnisse: unterEdit.ergebnisse,
        };
        try {
            await updateUntersuchung({
                id: uid,
                beschwerden: payload.beschwerden.trim() || null,
                ergebnisse: payload.ergebnisseJson.trim() || null,
                diagnose: payload.diagnose.trim() || null,
            });
            toast("Untersuchung gespeichert", "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateUntersuchung({
                            id: uid,
                            beschwerden: prevSnap.beschwerden ?? null,
                            ergebnisse: prevSnap.ergebnisse ?? null,
                            diagnose: prevSnap.diagnose ?? null,
                        });
                        await load();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            setUnterEdit(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const cancelAnamneseEdit = useCallback(() => {
        const p = parseAnamneseV1(anamneseJson);
        setAnamQuick({
            versicherungsstatus: p?.versicherungsstatus ?? "",
            krankenkasse: p?.krankenkasse ?? "",
            chronisch: p?.vorerkrankungen?.chronisch ?? "",
            allergienMed: p?.allergien?.medikamente ?? "",
        });
        setAnamEditing(false);
    }, [anamneseJson]);

    const runSaveAnamnese = async () => {
        if (!id) return;
        const merged = mergeQuickIntoAnamneseJson(anamneseJson, anamQuick);
        let antworten: unknown;
        try {
            antworten = JSON.parse(merged || "{}");
        } catch {
            toast("Anamnese: Ungültiges Datenformat");
            return;
        }
        const rollbackJson = anamneseJson;
        const rollbackQuick = { ...anamQuick };
        const rollbackSign = anamneseSign;
        let rollbackParsed: unknown;
        try {
            rollbackParsed = JSON.parse(mergeQuickIntoAnamneseJson(rollbackJson, rollbackQuick) || "{}");
        } catch {
            toast("Anamnese: Ungültiges Datenformat");
            return;
        }
        try {
            await saveAnamnesebogen({
                patient_id: id,
                antworten,
                unterschrieben: anamneseSign,
            });
            toast("Anamnese gespeichert", "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await saveAnamnesebogen({
                            patient_id: id,
                            antworten: rollbackParsed,
                            unterschrieben: rollbackSign,
                        });
                        await load();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            setAnamneseJson(JSON.stringify(antworten, null, 2));
            setAnamEditing(false);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleDeleteRezept = async () => {
        if (!rezeptDeleteId) return;
        const rid = rezeptDeleteId;
        try {
            await deleteRezept(rid);
            toast("Rezept gelöscht");
            setRezeptDeleteId(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleDeleteAttest = async () => {
        if (!attestDeleteId) return;
        const aid = attestDeleteId;
        try {
            await deleteAttest(aid);
            toast("Attest gelöscht");
            setAttestDeleteId(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const resetRezeptWizard = useCallback(() => {
        setRezeptWizardStep(null);
        setRezeptLines([]);
        setRezeptDraft(emptyRezeptLine());
        setRezeptSharedNotes("");
        setRezeptBaselineJson(null);
        setRezeptDraftErr(null);
        setRezeptComposerKind("neu");
        setRezeptComposerBusy(false);
        setRezeptPickQuery("");
        setRezeptPickSelectedId("");
        setRezeptPendingQueue(null);
        setRezeptNewVorlageTitel("");
    }, []);

    const resetAttestWizard = useCallback(() => {
        const t = new Date().toISOString().slice(0, 10);
        setAttestWizardStep(null);
        setAttestForm(emptyAttestComposerForm(t));
        setAttestBaselineJson(null);
        setAttestDraftErr(null);
        setAttestComposerKind("neu");
        setAttestComposerBusy(false);
        setAttestPickQuery("");
        setAttestPickSelectedId("");
        setAttestPendingQueue(null);
        setAttestNewVorlageTitel("");
    }, []);

    useEffect(() => {
        setAkteSaveConfirm(null);
        if (activeTab !== "unter") {
            setShowUnterComposer(false);
            setUnterEdit(null);
            setUnterDeleteId(null);
        }
        if (activeTab !== "behand") {
            setShowBehandComposer(false);
            setBehandComposerMode(null);
            setBehandEditId(null);
            setContinueFromBehandlungId("");
            setBehandDeleteId(null);
            setBehandFormUnlocked(true);
        }
        if (activeTab !== "rezept") {
            resetRezeptWizard();
            resetAttestWizard();
            setRezeptEdit(null);
            setRezeptDeleteId(null);
            setRezeptAttestSub("rezept");
            setAttestDeleteId(null);
        }
        if (activeTab !== "zahl") {
            setZahlEdit(null);
            setZahlDeleteId(null);
        }
        if (activeTab !== "stamm") {
            setShowEditPatient(false);
            setPatientDeleteOpen(false);
        }
    }, [activeTab, resetRezeptWizard, resetAttestWizard]);

    const persistPatientRezepte = async (queue: RezeptLine[], shared: string) => {
        if (!id || !session?.user_id) return;
        const createdIds: string[] = [];
        try {
            for (const line of queue) {
                const merged = [line.hinweise, shared].filter((s) => s.trim()).join(" · ");
                const r = await createRezept({
                    patient_id: id,
                    arzt_id: session.user_id,
                    medikament: line.medikament.trim(),
                    wirkstoff: line.wirkstoff.trim() || null,
                    dosierung: line.dosierung.trim(),
                    dauer: line.dauer.trim(),
                    hinweise: merged.trim() || null,
                });
                createdIds.push(r.id);
            }
            toast(`${queue.length} Rezept${queue.length === 1 ? "" : "e"} gespeichert`, "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        for (const rid of createdIds) {
                            await deleteRezept(rid);
                        }
                        await load();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            resetRezeptWizard();
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const persistPatientAttest = async (fields: AttestComposerFormFields, options?: { silent?: boolean }) => {
        if (!id || !session?.user_id) return null;
        const vErr = validateAttestComposer(fields);
        if (vErr) {
            toast(vErr, "error");
            return null;
        }
        const inhalt = buildAttestInhalt(fields);
        try {
            const created = await createAttest({
                patient_id: id,
                arzt_id: session.user_id,
                typ: fields.typ.trim(),
                inhalt,
                gueltig_von: fields.gueltig_von.slice(0, 10),
                gueltig_bis: fields.gueltig_bis.slice(0, 10),
            });
            if (!options?.silent) {
                toast("Attest gespeichert", "success", {
                    durationMs: TOAST_UNDO_MS,
                    onUndo: async () => {
                        try {
                            await deleteAttest(created.id);
                            await load();
                        } catch (e) {
                            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                        }
                    },
                });
            }
            resetAttestWizard();
            await load();
            return created.id;
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
            return null;
        }
    };

    const buildRezeptQueueFromComposer = (): RezeptLine[] | null => {
        const hasDraft =
            rezeptDraft.medikament.trim()
            || rezeptDraft.dosierung.trim()
            || rezeptDraft.dauer.trim()
            || rezeptDraft.wirkstoff.trim()
            || rezeptDraft.hinweise.trim();
        const out = [...rezeptLines];
        if (hasDraft) {
            const err = validateRezeptLine(rezeptDraft);
            if (err) {
                setRezeptDraftErr(err);
                return null;
            }
            out.push({ ...rezeptDraft });
        }
        if (out.length === 0) {
            setRezeptDraftErr("Mindestens eine vollständige Medikamentenzeile erforderlich.");
            return null;
        }
        setRezeptDraftErr(null);
        return out;
    };

    const submitRezeptComposer = async () => {
        const queue = buildRezeptQueueFromComposer();
        if (!queue) return;
        if (rezeptComposerKind === "vorlage") {
            void persistPatientRezepte(queue, rezeptSharedNotes);
            return;
        }
        setRezeptPendingQueue({ lines: queue, shared: rezeptSharedNotes });
        setRezeptComposerBusy(false);
        setRezeptLines([]);
        setRezeptDraft(emptyRezeptLine());
        setRezeptSharedNotes("");
        setRezeptBaselineJson(null);
        setRezeptDraftErr(null);
        setRezeptWizardStep("ask_vorlage");
    };

    const onRezeptAskVorlageNo = () => {
        const p = rezeptPendingQueue;
        if (!p) return;
        setRezeptPendingQueue(null);
        void persistPatientRezepte(p.lines, p.shared);
    };

    const onRezeptAskVorlageYes = () => {
        setRezeptNewVorlageTitel("");
        setRezeptWizardStep("name_vorlage");
    };

    const onRezeptNameVorlageSkip = () => {
        const p = rezeptPendingQueue;
        if (!p) return;
        setRezeptPendingQueue(null);
        void persistPatientRezepte(p.lines, p.shared);
    };

    const onRezeptNameVorlageSave = () => {
        const titel = rezeptNewVorlageTitel.trim();
        if (!titel) {
            toast("Bitte einen Namen für die Vorlage eingeben.", "error");
            return;
        }
        const p = rezeptPendingQueue;
        if (!p) return;
        setAkteSaveConfirm({ kind: "rezept_finalize_vorlage", titel, lines: p.lines, shared: p.shared });
    };

    const submitAttestComposer = () => {
        const err = validateAttestComposer(attestForm);
        if (err) {
            setAttestDraftErr(err);
            return;
        }
        setAttestDraftErr(null);
        if (attestComposerKind === "vorlage") {
            void persistPatientAttest(attestForm);
            return;
        }
        setAttestPendingQueue({ ...attestForm });
        setAttestWizardStep("ask_vorlage");
        setAttestForm(emptyAttestComposerForm(new Date().toISOString().slice(0, 10)));
    };

    const onAttestAskVorlageNo = () => {
        const p = attestPendingQueue;
        if (!p) return;
        setAttestPendingQueue(null);
        void persistPatientAttest(p);
    };

    const onAttestAskVorlageYes = () => {
        setAttestNewVorlageTitel("");
        setAttestWizardStep("name_vorlage");
    };

    const onAttestNameVorlageSkip = () => {
        const p = attestPendingQueue;
        if (!p) return;
        setAttestPendingQueue(null);
        void persistPatientAttest(p);
    };

    const onAttestNameVorlageSave = () => {
        const titel = attestNewVorlageTitel.trim();
        if (!titel) {
            toast("Bitte einen Namen für die Vorlage eingeben.", "error");
            return;
        }
        const p = attestPendingQueue;
        if (!p) return;
        setAkteSaveConfirm({ kind: "attest_finalize_vorlage", titel, fields: p });
    };

    const runSaveRezeptEdit = async () => {
        if (!rezeptEdit) return;
        if (!rezeptEditUnlocked) {
            toast("Zum Bearbeiten zuerst „Bearbeiten“ wählen.", "info");
            return;
        }
        const rid = rezeptEdit.id;
        const prevSnap = {
            medikament: rezeptEdit.medikament,
            wirkstoff: rezeptEdit.wirkstoff,
            dosierung: rezeptEdit.dosierung,
            dauer: rezeptEdit.dauer,
            hinweise: rezeptEdit.hinweise,
        };
        try {
            await updateRezept({
                id: rid,
                medikament: rezeptEditForm.medikament.trim(),
                wirkstoff: rezeptEditForm.wirkstoff.trim() || null,
                dosierung: rezeptEditForm.dosierung.trim(),
                dauer: rezeptEditForm.dauer.trim(),
                hinweise: rezeptEditForm.hinweise.trim() || null,
            });
            toast("Rezept gespeichert", "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateRezept({
                            id: rid,
                            medikament: prevSnap.medikament,
                            wirkstoff: prevSnap.wirkstoff,
                            dosierung: prevSnap.dosierung,
                            dauer: prevSnap.dauer,
                            hinweise: prevSnap.hinweise,
                        });
                        await load();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            setRezeptEdit(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const runSaveZahlEdit = async () => {
        if (!zahlEdit) return;
        if (!zahlEditUnlocked) {
            toast("Zum Bearbeiten zuerst „Bearbeiten“ wählen.", "info");
            return;
        }
        const betrag = Number(String(zahlEditForm.betrag).replace(",", "."));
        if (!Number.isFinite(betrag) || betrag <= 0) {
            toast("Bitte gültigen Betrag eingeben.", "error");
            return;
        }
        if (zahlEdit.behandlung_id && id && zahlEditMaxBetragEur != null && betrag > zahlEditMaxBetragEur + ZAHL_EUR_EPS) {
            toast(
                `Der Betrag darf maximal ${formatCurrency(zahlEditMaxBetragEur)} sein (offener Anteil für diese Behandlung).`,
                "error",
            );
            return;
        }
        const prevRow = zahlungen.find((z) => z.id === zahlEdit.id);
        if (!prevRow) {
            toast("Zahlung nicht mehr geladen.", "error");
            return;
        }
        try {
            await updateZahlung({
                id: zahlEdit.id,
                betrag,
                zahlungsart: zahlEditForm.zahlungsart,
                leistung_id: zahlEdit.leistung_id,
                beschreibung: zahlEditForm.beschreibung.trim() || null,
            });
            toast("Zahlung aktualisiert", "success", {
                durationMs: TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateZahlung({
                            id: prevRow.id,
                            betrag: prevRow.betrag,
                            zahlungsart: prevRow.zahlungsart,
                            leistung_id: prevRow.leistung_id,
                            beschreibung: prevRow.beschreibung,
                        });
                        await load();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            setZahlEdit(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const submitSaveZahlNew = async () => {
        if (!id) return;
        if (!zahlNewForm.linkKind || !zahlNewForm.linkId.trim()) {
            toast("Bitte eine Behandlung (B) oder Untersuchung (U) zuordnen.", "error");
            return;
        }
        const betrag = Number(String(zahlNewForm.betrag).replace(",", "."));
        if (!Number.isFinite(betrag) || betrag <= 0) {
            toast("Bitte gültigen Zahlbetrag eingeben.", "error");
            return;
        }
        const selBh =
            zahlNewForm.linkKind === "behand"
                ? behandlungen.find((b) => b.id === zahlNewForm.linkId)
                : undefined;
        const gesamt =
            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
        const paidSoFar =
            zahlNewForm.linkKind === "behand" && zahlNewForm.linkId
                ? sumZahlungenForBehandlung(zahlungen, id, zahlNewForm.linkId)
                : 0;
        let openBefore: number | undefined;
        if (zahlNewForm.linkKind === "behand" && zahlNewForm.linkId && gesamt != null && Number.isFinite(gesamt)) {
            openBefore = Math.max(0, roundMoney2(gesamt - paidSoFar));
        } else {
            openBefore = undefined;
        }
        if (zahlNewForm.linkKind === "behand" && openBefore != null && betrag > openBefore + ZAHL_EUR_EPS) {
            toast(
                `Der Zahlbetrag darf den offenen Betrag (${formatCurrency(openBefore)}) nicht übersteigen.`,
                "error",
            );
            return;
        }
        try {
            await createZahlung({
                patient_id: id,
                betrag,
                zahlungsart: zahlNewForm.zahlungsart,
                beschreibung: zahlNewForm.beschreibung.trim() || undefined,
                behandlung_id: zahlNewForm.linkKind === "behand" ? zahlNewForm.linkId : undefined,
                untersuchung_id: zahlNewForm.linkKind === "unter" ? zahlNewForm.linkId : undefined,
                betrag_erwartet: openBefore,
            });
            toast("Zahlung erfasst", "success");
            setShowZahlComposer(false);
            setZahlNewForm({
                linkKind: "",
                linkId: "",
                betrag: "",
                zahlungsart: "BAR",
                beschreibung: "",
            });
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleDeleteBehandlungRow = async () => {
        if (!behandDeleteId) return;
        try {
            await deleteBehandlung(behandDeleteId);
            toast("Behandlung gelöscht");
            setBehandDeleteId(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleDeleteUntersuchungRow = async () => {
        if (!unterDeleteId) return;
        try {
            await deleteUntersuchung(unterDeleteId);
            toast("Untersuchung gelöscht");
            setUnterDeleteId(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleDeleteZahlungRow = async () => {
        if (!zahlDeleteId) return;
        try {
            await deleteZahlung(zahlDeleteId);
            toast("Zahlung gelöscht");
            setZahlDeleteId(null);
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const flushAkteSave = async () => {
        const p = akteSaveConfirm;
        if (!p) return;
        setAkteSaveBusy(true);
        try {
            switch (p.kind) {
                case "rezept_finalize_vorlage":
                    setRezeptComposerBusy(true);
                    try {
                        await createDokumentVorlage({
                            kind: "REZEPT",
                            titel: p.titel,
                            payload: { items: rezeptLinesToVorlageItems(p.lines) },
                        });
                        toast("Vorlage für die Praxis gespeichert", "success");
                        try {
                            const all = await listDokumentVorlagen();
                            setRezeptVorlagen(all.filter((x) => x.kind === "REZEPT"));
                        } catch {
                            /* ignore */
                        }
                        setRezeptPendingQueue(null);
                        setRezeptNewVorlageTitel("");
                        await persistPatientRezepte(p.lines, p.shared);
                    } finally {
                        setRezeptComposerBusy(false);
                    }
                    break;
                case "attest_finalize_vorlage":
                    setAttestComposerBusy(true);
                    try {
                        const n = Number.parseInt(p.fields.tageAnzahl.trim(), 10);
                        await createDokumentVorlage({
                            kind: "ATTEST",
                            titel: p.titel,
                            payload: {
                                krankheiten: p.fields.krankheiten.trim(),
                                tage_anzahl: Number.isFinite(n) ? n : p.fields.tageAnzahl.trim(),
                                einschraenkung: p.fields.einschraenkung.trim(),
                            },
                        });
                        try {
                            const all = await listDokumentVorlagen();
                            setAttestVorlagen(all.filter((x) => x.kind === "ATTEST"));
                        } catch {
                            /* ignore */
                        }
                        setAttestPendingQueue(null);
                        setAttestNewVorlageTitel("");
                        const attestId = await persistPatientAttest(p.fields, { silent: true });
                        if (attestId) {
                            toast("Vorlage angelegt und Attest gespeichert", "success", {
                                durationMs: TOAST_UNDO_MS,
                                onUndo: async () => {
                                    try {
                                        await deleteAttest(attestId);
                                        await load();
                                    } catch (e) {
                                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                                    }
                                },
                            });
                        }
                    } finally {
                        setAttestComposerBusy(false);
                    }
                    break;
                case "anlage_add": {
                    if (!akte) break;
                    const displayName = deriveAnlageDisplayName(p.file);
                    const b64 = await fileToBase64ForAnlage(p.file);
                    await createAkteAnlage({
                        akte_id: akte.id,
                        display_name: displayName,
                        mime_type: p.file.type || "application/octet-stream",
                        bytes_base64: b64,
                    });
                    toast("Anlage gespeichert", "success");
                    await refreshAnlagen(akte.id);
                    break;
                }
                case "anlage_remove": {
                    await deleteAkteAnlage(p.id);
                    if (akte) await refreshAnlagen(akte.id);
                    toast("Anlage entfernt", "info");
                    break;
                }
                default:
                    break;
            }
        } catch (e) {
            if (e instanceof Error && (e.message === "invalid-json" || e.message === "invalid-betrag")) {
                /* bereits per Toast gemeldet */
            } else {
                toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        } finally {
            setAkteSaveBusy(false);
            setAkteSaveConfirm(null);
        }
    };

    const cancelAkteSave = () => {
        if (akteSaveBusy) return;
        setAkteSaveConfirm(null);
    };

    const handleDeletePatient = async () => {
        if (!id || !canViewClinical) return;
        setPatientDeleteBusy(true);
        try {
            await deletePatient(id);
            clearPatientScopedBrowserStorage(id);
            toast("Akte wurde gelöscht");
            setPatientDeleteOpen(false);
            navigate("/patienten");
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setPatientDeleteBusy(false);
        }
    };

    const anamneseMergedForPreview = useMemo(
        () => mergeQuickIntoAnamneseJson(anamneseJson, anamQuick),
        [anamneseJson, anamQuick],
    );
    const parsedAnamnesePreview = useMemo(
        () => parseAnamneseV1(anamneseMergedForPreview),
        [anamneseMergedForPreview],
    );
    const kategorieOptions = useMemo(() => {
        const fallback = ["Kontrolluntersuchung", "Fuellungstherapie", "Parodontologie", "Chirurgie", "Prothetik"];
        const s = new Set<string>([...fallback, ...katalog.map((k) => k.kategorie)]);
        if (behandForm.kategorie) s.add(behandForm.kategorie);
        const rest = Array.from(s)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "de"))
            .map((value) => ({ value, label: value }));
        return [{ value: "", label: "— Kategorie wählen —" }, ...rest];
    }, [katalog, behandForm.kategorie]);
    const leistungOptions = useMemo(() => {
        if (!behandForm.kategorie) {
            return [{ value: "", label: "— zuerst Kategorie wählen —" }];
        }
        const filtered = katalog.filter((k) => k.kategorie === behandForm.kategorie);
        return [{ value: "", label: "— Leistung wählen —" }, ...filtered.map((k) => ({ value: k.id, label: k.name }))];
    }, [katalog, behandForm.kategorie]);
    const behandlungGroups = useMemo(() => {
        const keyOf = (b: Behandlung) => {
            const n = (b.behandlungsnummer ?? "").trim();
            return n || `__id_${b.id}`;
        };
        const map = new Map<string, Behandlung[]>();
        const order: string[] = [];
        for (const b of behandlungen) {
            const k = keyOf(b);
            if (!map.has(k)) {
                map.set(k, []);
                order.push(k);
            }
            map.get(k)!.push(b);
        }
        return order.map((key) => map.get(key)!);
    }, [behandlungen]);

    /**
     * Generate the next available `B-{YYYY}-{seq}` number for this akte.
     * Sequence resets per year to keep numbers short and predictable.
     */
    const generateNewBehandlungsnummer = useCallback(() => {
        const year = new Date().getFullYear();
        const prefix = `B-${year}-`;
        let max = 0;
        for (const b of behandlungen) {
            const n = (b.behandlungsnummer ?? "").trim();
            if (!n.startsWith(prefix)) continue;
            const tail = n.slice(prefix.length);
            const m = /^(\d+)/.exec(tail);
            if (!m) continue;
            const v = Number.parseInt(m[1], 10);
            if (Number.isFinite(v) && v > max) max = v;
        }
        const next = String(max + 1).padStart(3, "0");
        return `${prefix}${next}`;
    }, [behandlungen]);

    const applyContinueFromBehandlung = useCallback(
        (behandlungId: string) => {
            const b = behandlungen.find((x) => x.id === behandlungId);
            if (!b) return;
            const bn = (b.behandlungsnummer ?? "").trim();
            if (!bn) {
                toast("Diese Zeile hat keine B.Nummer — bitte andere Zeile wählen.", "info");
                return;
            }
            const same = behandlungen.filter((x) => (x.behandlungsnummer ?? "").trim() === bn);
            const nextSitz = same.reduce((acc, x) => Math.max(acc, x.sitzung ?? 0), 0) + 1;
            const kid = resolveKatalogIdForBehandlung(katalog, b);
            setContinueFromBehandlungId(behandlungId);
            setBehandForm({
                datum: new Date().toISOString().slice(0, 10),
                kategorie: b.kategorie ?? b.art ?? "",
                leistungsname: b.leistungsname ?? b.beschreibung ?? b.art ?? "",
                leistungKatalogId: kid,
                behandlungsnummer: bn,
                sitzung: String(nextSitz),
                gesamtkosten: "",
                behandlung_status: "DURCHGEFUEHRT",
                termin_erforderlich: "0",
                notizen: "",
            });
            setSelectedBehandTooth(b.zaehne ?? null);
        },
        [behandlungen, katalog, toast],
    );

    const continueBehandlungOptions = useMemo(
        () =>
            behandlungen.map((b) => ({
                value: b.id,
                label: behandlungContinueLabel(b),
            })),
        [behandlungen],
    );

    const nextUnterPreview = useMemo(
        () => previewNextUntersuchungsnummer(untersuchungen.map((u) => u.untersuchungsnummer)),
        [untersuchungen],
    );

    const zahlLinkSelectOptionsOpen = useMemo(() => {
        if (!id) return [{ value: "", label: "—" }];
        return buildOpenZahlLinkSelectOptions(zahlungen, id, behandlungen, untersuchungen);
    }, [id, zahlungen, behandlungen, untersuchungen]);

    const zahlZuordnungSummaries = useMemo(
        () => (id ? aggregateZahlungenByZuordnung(zahlungen, id, behandlungen, untersuchungen) : []),
        [id, zahlungen, behandlungen, untersuchungen],
    );

    const zahlungenHistorisch = useMemo(
        () =>
            [...zahlungen].sort((a, b) =>
                String(b.created_at).localeCompare(String(a.created_at)),
            ),
        [zahlungen],
    );

    const zahlNeuMaxBetragEur = useMemo(() => {
        if (!id || zahlNewForm.linkKind !== "behand" || !zahlNewForm.linkId) return null;
        const selBh = behandlungen.find((b) => b.id === zahlNewForm.linkId);
        const gesamt =
            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
        return maxNeuZahlungBehandlung(zahlungen, id, zahlNewForm.linkId, gesamt);
    }, [id, zahlNewForm.linkKind, zahlNewForm.linkId, behandlungen, zahlungen]);

    const zahlEditMaxBetragEur = (() => {
        if (!id || !zahlEdit?.behandlung_id) return null;
        const bRow = behandlungen.find((x) => x.id === zahlEdit.behandlung_id);
        const gesamt =
            bRow?.gesamtkosten != null && Number.isFinite(bRow.gesamtkosten) ? bRow.gesamtkosten : null;
        return maxEditZahlungBehandlung(zahlungen, id, zahlEdit.behandlung_id, zahlEdit.id, gesamt);
    })();

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
            <Button type="button" variant="secondary" size="sm" onClick={() => setZahlEditUnlocked(true)}>
                Bearbeiten
            </Button>
        ) : null;

    const zahlEditPanelFooter =
        zahlEdit && canFinanzenWrite ? (
            <>
                <Button type="button" variant="ghost" onClick={() => setZahlEdit(null)}>
                    Abbrechen
                </Button>
                <Button
                    type="button"
                    disabled={
                        !zahlEditUnlocked
                        || zahlEditMaxBetragEur != null && zahlEditMaxBetragEur <= ZAHL_EUR_EPS
                    }
                    onClick={() => void runSaveZahlEdit()}
                >
                    Speichern
                </Button>
            </>
        ) : null;

    const behandFieldsLocked = Boolean(behandEditId) && !behandFormUnlocked;

    const behandComposerCommon = {
        navigate,
        akte,
        befunde,
        selectedBehandTooth,
        onSelectTooth: setSelectedBehandTooth,
        behandEditId,
        behandComposerMode,
        behandFieldsLocked,
        onUnlockFields: () => setBehandFormUnlocked(true),
        onCancelComposer: () => {
            setShowBehandComposer(false);
            setBehandComposerMode(null);
            setBehandEditId(null);
            setContinueFromBehandlungId("");
            setBehandFormUnlocked(true);
        },
        continueBehandlungOptions,
        continueFromBehandlungId,
        applyContinueFromBehandlung,
        behandForm,
        setBehandForm,
        kategorieOptions,
        leistungOptions,
        katalog,
        planNext,
        runSaveBehandlung,
    } satisfies BehandlungAkteComposerPanelProps;

    const rezeptPickFiltered = useMemo(() => {
        const q = rezeptPickQuery.trim().toLowerCase();
        if (!q) return rezeptVorlagen;
        return rezeptVorlagen.filter((v) => v.titel.toLowerCase().includes(q));
    }, [rezeptVorlagen, rezeptPickQuery]);

    const rezeptListeGeaendert = useMemo(() => {
        if (rezeptComposerKind !== "vorlage" || !rezeptBaselineJson) return false;
        return JSON.stringify(rezeptLines) !== rezeptBaselineJson;
    }, [rezeptComposerKind, rezeptBaselineJson, rezeptLines]);

    const attestPickFiltered = useMemo(() => {
        const q = attestPickQuery.trim().toLowerCase();
        if (!q) return attestVorlagen;
        return attestVorlagen.filter((v) => v.titel.toLowerCase().includes(q));
    }, [attestVorlagen, attestPickQuery]);

    const attestListeGeaendert = useMemo(() => {
        if (attestComposerKind !== "vorlage" || !attestBaselineJson) return false;
        return JSON.stringify(attestForm) !== attestBaselineJson;
    }, [attestComposerKind, attestBaselineJson, attestForm]);

    useEffect(() => {
        if (activeTab !== "rezept" || !canWriteMedical) return;
        let cancelled = false;
        void listDokumentVorlagen()
            .then((all) => {
                if (!cancelled) {
                    setRezeptVorlagen(all.filter((v) => v.kind === "REZEPT"));
                    setAttestVorlagen(all.filter((v) => v.kind === "ATTEST"));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setRezeptVorlagen([]);
                    setAttestVorlagen([]);
                }
            });
        return () => { cancelled = true; };
    }, [activeTab, canWriteMedical]);

    if (!id) {
        return (
            <div className="animate-fade-in">
                <Button variant="ghost" size="sm" onClick={() => navigate("/patienten")}>← Zurück</Button>
                <p className="text-body text-on-surface-variant mt-4">Kein Patient ausgewählt.</p>
            </div>
        );
    }

    if (patientLoadError) {
        return (
            <div className="space-y-4 animate-fade-in">
                <Button variant="ghost" size="sm" onClick={() => navigate("/patienten")}>← Zurück</Button>
                <div className="rounded-lg bg-error-container text-error px-4 py-3 text-body max-w-xl">
                    {patientLoadError}
                </div>
                <Button onClick={() => load()}>Erneut versuchen</Button>
            </div>
        );
    }

    if (!patient) return <PageLoading label="Patient wird geladen…" />;

    const akteTabs: { id: AkteTab; label: string; needsClinical?: boolean }[] = [
        { id: "stamm", label: "Stammdaten" },
        { id: "anam", label: "Anamnese", needsClinical: true },
        { id: "unter", label: "Untersuchungen", needsClinical: true },
        { id: "behand", label: "Behandlungen", needsClinical: true },
        { id: "rezept", label: "Rezepte & Atteste" },
        { id: "anlage", label: "Extra Anlagen" },
        { id: "zahl", label: "Kundenleistungen" },
    ];

    const akteTabSections: { heading: string; tabIds: AkteTab[] }[] = [
        { heading: "Verwaltung", tabIds: ["stamm", "anam"] },
        { heading: "Klinik", tabIds: ["unter", "behand", "rezept"] },
        { heading: "Dokumente & Finanzen", tabIds: ["anlage", "zahl"] },
    ];

    /** Welche Sektionen enthalten Daten? (Nur noch Stammdaten + Anamnese auf Sektionsebene.) */
    const hasSectionData = {
        stamm: true, // Stammdaten existieren immer, sobald Akte angelegt ist
        anam: anamneseJson.trim().length > 0,
        anlage: anlagen.length > 0,
        zahl: zahlungen.length > 0,
    } as const;
    const anlPending = anlagen.filter((a) => !itemValidation[itemValidationKey("anl", a.id)]).length;
    const zahlPending = zahlungen.filter((z) => !itemValidation[itemValidationKey("zahl", z.id)]).length;
    const validationPendingTotal =
        (!validation.stamm ? 1 : 0)
        + anlPending
        + zahlPending;

    const openRezeptPick = () => {
        setRezeptEdit(null);
        setRezeptDeleteId(null);
        resetRezeptWizard();
        setRezeptWizardStep("pick");
    };

    const proceedRezeptPick = () => {
        const sel =
            rezeptPickSelectedId
            || rezeptVorlagen.find((v) => v.titel.toLowerCase() === rezeptPickQuery.trim().toLowerCase())?.id
            || "";
        const v = rezeptVorlagen.find((x) => x.id === sel);
        if (!v) {
            toast("Bitte eine Vorlage aus der Liste wählen oder den Namen exakt eingeben.", "error");
            return;
        }
        const lines = vorlageItemsToLines(parseRezeptVorlagePayload(v.payload));
        if (lines.length === 0) {
            toast("Diese Vorlage enthält keine Medikamente.", "error");
            return;
        }
        setRezeptLines(lines.map((ln) => ({ ...ln })));
        setRezeptBaselineJson(JSON.stringify(lines));
        setRezeptComposerKind("vorlage");
        setRezeptDraft(emptyRezeptLine());
        setRezeptSharedNotes("");
        setRezeptDraftErr(null);
        setRezeptWizardStep("compose");
    };

    const openRezeptNeu = () => {
        setRezeptEdit(null);
        setRezeptDeleteId(null);
        resetRezeptWizard();
        setRezeptComposerKind("neu");
        setRezeptWizardStep("compose");
    };

    const openAttestPick = () => {
        setAttestDeleteId(null);
        resetAttestWizard();
        setAttestWizardStep("pick");
    };

    const proceedAttestPick = () => {
        const sel =
            attestPickSelectedId
            || attestVorlagen.find((v) => v.titel.toLowerCase() === attestPickQuery.trim().toLowerCase())?.id
            || "";
        const v = attestVorlagen.find((x) => x.id === sel);
        if (!v) {
            toast("Bitte eine Vorlage aus der Liste wählen oder den Namen exakt eingeben.", "error");
            return;
        }
        const parsed = parseAttestVorlagePayload(v.payload);
        const rawTage = parsed.tageAnzahl.trim() || "1";
        const n = Number.parseInt(rawTage, 10);
        if (!Number.isFinite(n) || n < 1 || n > 366) {
            toast("Diese Vorlage enthält keine gültige Tagesanzahl (1–366).", "error");
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const krank = parsed.krankheiten.trim() || (KRANKHEITEN_SUGGESTIONS[0] ?? "");
        const nextForm: AttestComposerFormFields = {
            typ: ATTEST_TYP_OPTIONS[0]!.value,
            krankheiten: krank,
            tageAnzahl: String(n),
            einschraenkung: parsed.einschraenkung.trim(),
            gueltig_von: today,
            gueltig_bis: attestGueltigBisFromVonAndTage(today, String(n)),
        };
        setAttestForm(nextForm);
        setAttestBaselineJson(JSON.stringify(nextForm));
        setAttestComposerKind("vorlage");
        setAttestDraftErr(null);
        setAttestWizardStep("compose");
    };

    const openAttestNeu = () => {
        setAttestDeleteId(null);
        resetAttestWizard();
        setAttestComposerKind("neu");
        setAttestWizardStep("compose");
    };

    const handlePrintAttest = (a: Attest) => {
        setHtmlDocExport({
            kind: "attest",
            bundle: bundleAttestExport(a, patient),
            suggestedBasename: suggestAttestExportBasename(a),
            exportPreviewTitle: `Attest — ${patient.name}`,
        });
    };

    const handlePrintQuittung = (z: Zahlung) => {
        setHtmlDocExport({
            kind: "quittung",
            bundle: bundleQuittungExport(z, patient, behandlungen, untersuchungen),
            suggestedBasename: suggestQuittungExportBasename(z),
            exportPreviewTitle: `Quittung — ${patient.name}`,
        });
    };

    const handlePrintQuittungFromSummeRow = (row: ZahlZuordnungSummaryRow) => {
        if (!id) return;
        const z = latestZahlungForZuordnungRow(row, zahlungen, id);
        if (!z) {
            toast("Keine druckbare Buchung für diese Zuordnung.", "info");
            return;
        }
        handlePrintQuittung(z);
    };

    const handlePrintRezept = (r: Rezept) => {
        setHtmlDocExport({
            kind: "rezept",
            bundle: bundleRezeptExport(r, patient),
            suggestedBasename: suggestRezeptExportBasename(r),
            exportPreviewTitle: `Rezept — ${patient.name}`,
        });
    };

    const patchRezeptLine = (idx: number, part: Partial<RezeptLine>) => {
        setRezeptLines((prev) => prev.map((row, j) => (j === idx ? { ...row, ...part } : row)));
    };

    const pickMedForRezeptDraft = (label: string) => {
        const sugg = findSuggestion(label);
        setRezeptDraft((prev) => ({
            ...prev,
            medikament: label,
            wirkstoff: prev.wirkstoff || sugg?.wirkstoff || "",
            dosierung: prev.dosierung || sugg?.dosierung || "",
        }));
    };

    const addRezeptDraftLine = () => {
        const err = validateRezeptLine(rezeptDraft);
        if (err) {
            setRezeptDraftErr(err);
            return;
        }
        setRezeptLines((prev) => [...prev, { ...rezeptDraft }]);
        setRezeptDraft(emptyRezeptLine());
        setRezeptDraftErr(null);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className="btn btn-subtle" onClick={() => navigate("/patienten")}><ChevronLeftIcon />Zurück</button>
                <h1 className="page-title" style={{ margin: 0, flex: "1 1 200px" }}>
                    Akte von {patient.name}
                    {validationPendingTotal > 0 ? (
                        <span
                            className="tab-badge warn"
                            style={{ marginLeft: 10, verticalAlign: "middle" }}
                            title={`${validationPendingTotal} offene Punkt${validationPendingTotal === 1 ? "" : "e"} zur ärztlichen Validierung`}
                        >
                            {validationPendingTotal}
                        </span>
                    ) : null}
                </h1>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={() => setShowPlanTip((v) => !v)}
                        title="Hinweise an die Rezeption für die nächste Terminplanung"
                        aria-pressed={showPlanTip}
                        style={planNextHasContent(planNext) ? { borderColor: "var(--accent)", color: "var(--accent-ink)", background: "var(--accent-soft)" } : undefined}
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
                        onClick={() => setAkteExportPickerOpen(true)}
                        disabled={!id || !patient}
                        title="Export — Bereiche, Format, Speicherort"
                    >
                        <ExportIcon />Export
                    </button>
                    <button type="button" className="btn btn-accent" onClick={() => navigate(terminBackLink)}><CalendarIcon />Termin</button>
                </div>
            </div>
            {showPlanTip ? (
                <div
                    className="card"
                    role="region"
                    aria-label="Terminplanung für Rezeption"
                    style={{ padding: 14, borderColor: "var(--accent)" }}
                >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Nächster Termin — Kontext für die Rezeption</div>
                            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                                Wird beim Anlegen eines Termins als Karten-Vorschau angezeigt (Dringlichkeit, Abstand, Dauer, Wunsch-Tage).
                            </div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPlanTip(false)}>Schließen</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            id="plan-urgency"
                            label="Dringlichkeit"
                            value={planNext.urgency}
                            onChange={(e) =>
                                persistPlanNext({ ...planNext, urgency: e.target.value as PlanNextTerminV2["urgency"] })}
                            options={[
                                { value: "routine", label: "Routine / planbar" },
                                { value: "bald", label: "Zeitnah (1–3 Wochen)" },
                                { value: "dringend", label: "Dringend" },
                            ]}
                        />
                        <Select
                            id="plan-interval"
                            label="Abstand (Orientierung)"
                            value={planNext.intervalWeeks}
                            onChange={(e) => persistPlanNext({ ...planNext, intervalWeeks: e.target.value })}
                            options={[
                                { value: "", label: "— keine Vorgabe —" },
                                { value: "2", label: "ca. 2 Wochen" },
                                { value: "4", label: "ca. 4 Wochen" },
                                { value: "6", label: "ca. 6 Wochen" },
                                { value: "12", label: "ca. 12 Wochen" },
                                { value: "26", label: "ca. 6 Monate" },
                            ]}
                        />
                        <Select
                            id="plan-art"
                            label="Terminart (Vorschlag)"
                            value={planNext.terminArtHint}
                            onChange={(e) => persistPlanNext({ ...planNext, terminArtHint: e.target.value })}
                            options={[
                                { value: "", label: "— offen —" },
                                { value: "KONTROLLE", label: "Kontrolle" },
                                { value: "BEHANDLUNG", label: "Behandlung" },
                                { value: "UNTERSUCHUNG", label: "Untersuchung" },
                                { value: "BERATUNG", label: "Beratung" },
                                { value: "NOTFALL", label: "Notfall" },
                            ]}
                        />
                        <Input
                            id="plan-dur"
                            label="Geschätzte Dauer (Min.)"
                            value={planNext.durationMin}
                            onChange={(e) => persistPlanNext({ ...planNext, durationMin: e.target.value })}
                            placeholder="z. B. 30"
                        />
                        <div className="md:col-span-2">
                            <Input
                                id="plan-days"
                                label="Bevorzugte Wochentage"
                                value={planNext.preferredWeekdays}
                                onChange={(e) => persistPlanNext({ ...planNext, preferredWeekdays: e.target.value })}
                                placeholder="z. B. Mo, Do"
                            />
                        </div>
                    </div>
                    <Textarea
                        id="patient-plan-freetext"
                        label="Kurztext für die Rezeption"
                        rows={3}
                        value={planNext.freeText}
                        onChange={(e) => persistPlanNext({ ...planNext, freeText: e.target.value })}
                        placeholder="z. B. „Nach Füllung 36: Recall, Prophylaxe 30 Min.“"
                    />
                    <Textarea
                        id="patient-plan-internal"
                        label="Interne Notiz (nur Praxis, optional)"
                        rows={2}
                        value={planNext.internalNote}
                        onChange={(e) => persistPlanNext({ ...planNext, internalNote: e.target.value })}
                        placeholder="z. B. „Patient nur vormittags.“"
                    />
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                        {planNextHasContent(planNext) ? (
                            <Button size="sm" variant="ghost" onClick={() => persistPlanNext(emptyPlanNextTermin())}>
                                Alle Hinweise leeren
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <div className="card patient-hero-card">
                <div className="patient-hero-top">
                    <div className="patient-hero-identity">
                        <div className="av av-lg" style={{ background: "linear-gradient(135deg,#B6E7DA,#0EA07E)" }}>
                            {patient.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div className="patient-hero-identity-text">
                            <div className="patient-hero-name-row">
                                <h2 className="patient-hero-name">{patient.name}</h2>
                                <Badge variant="primary">{patient.status}</Badge>
                                {zahlungen.some(
                                    (z) =>
                                        z.patient_id === patient.id
                                        && (z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT"),
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
                    <span title="Geburtstag / Alter">
                        <CalendarIcon size={12} /> {formatDate(patient.geburtsdatum)}
                        {(() => {
                            const alter = alterAusGeburtsdatum(patient.geburtsdatum);
                            return alter != null ? <> · <strong style={{ color: "var(--fg-2)", fontWeight: 600 }}>{alter} J.</strong></> : null;
                        })()}
                    </span>
                    <span title="Telefon">
                        <PhoneIcon size={12} /> {patient.telefon || "—"}
                    </span>
                    <span title="E-Mail">
                        <MailIcon size={12} /> {patient.email || "—"}
                    </span>
                    <span title="Versicherungsnummer">V: {patient.versicherungsnummer}</span>
                </div>
            </div>

            <div className="akte-workspace" style={{ display: "grid", gridTemplateColumns: "minmax(200px, 220px) 1fr", gap: 20 }}>
                <nav className="akte-subnav" role="tablist" aria-label="Patientenakte">
                    {akteTabSections.map((section, si) => (
                        <Fragment key={section.heading}>
                            <div
                                className="akte-subnav-group-heading"
                                style={{
                                    gridColumn: "1 / -1",
                                    padding: si === 0 ? "0 0 4px" : "14px 0 4px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    color: "var(--fg-4)",
                                }}
                            >
                                {section.heading}
                            </div>
                            {section.tabIds.map((tabId) => {
                                const tab = akteTabs.find((t) => t.id === tabId);
                                if (!tab) return null;
                                const blocked = Boolean(tab.needsClinical && !canViewClinical);
                                let badge: { tone: "warn" | "ok"; text: string } | null = null;
                                if (tab.id === "stamm") {
                                    if (!validation.stamm) badge = { tone: "warn", text: "!" };
                                    else badge = { tone: "ok", text: "✓" };
                                } else if (tab.id === "anam") {
                                    if (!validation.stamm) badge = { tone: "warn", text: "!" };
                                    else badge = { tone: "ok", text: "✓" };
                                } else if (tab.id === "unter" || tab.id === "behand" || tab.id === "rezept") {
                                    badge = null;
                                } else if (tab.id === "anlage") {
                                    if (anlagen.length === 0) badge = null;
                                    else if (anlPending === 0) badge = { tone: "ok", text: "✓" };
                                    else badge = { tone: "warn", text: anlPending > 1 ? String(anlPending) : "!" };
                                } else if (tab.id === "zahl") {
                                    if (zahlungen.length === 0) badge = null;
                                    else if (zahlPending === 0) badge = { tone: "ok", text: "✓" };
                                    else badge = { tone: "warn", text: zahlPending > 1 ? String(zahlPending) : "!" };
                                }
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        id={`tab-${tab.id}`}
                                        aria-selected={activeTab === tab.id}
                                        aria-controls={`panel-${tab.id}`}
                                        disabled={blocked}
                                        className={`${activeTab === tab.id ? "active" : ""}`}
                                        title={
                                            tab.id === "anam"
                                                ? "Gilt gemeinsam mit Stammdaten (ein gemeinsamer Validierungsschritt)"
                                                : undefined
                                        }
                                        onClick={() => {
                                            if (blocked) {
                                                toast("Bereich nur für ärztliche Rolle.", "info");
                                                return;
                                            }
                                            goTab(tab.id);
                                        }}
                                    >
                                        <span>{tab.label}</span>
                                        {badge ? (
                                            <span className={`tab-badge ${badge.tone}`} aria-hidden>
                                                {badge.text}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </Fragment>
                    ))}
                </nav>
                <div className="col" style={{ gap: 16, minWidth: 0 }}>
                    {akteLoadError ? <div className="card card-pad" role="alert" style={{ color: "var(--red)" }}>{akteLoadError}</div> : null}

            {activeTab === "stamm" && (
                <div id="panel-stamm" role="tabpanel" aria-labelledby="tab-stamm">
                    <div className="col" style={{ gap: 16 }}>
                        <Card className="card-pad">
                            <CardHeader
                                title="Stammdaten"
                                subtitle={validation.stamm
                                    ? `Stammdaten & Anamnese geprüft · ${formatDateTime(validation.stamm.validatedAt)}`
                                    : "Vom Empfang erfasst — mit „Validieren“ Stammdaten und Anamnese zusammen bestätigen"}
                                action={(
                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                setPatientDeleteOpen(false);
                                                setShowEditPatient(true);
                                            }}
                                        >
                                            <EditIcon />Bearbeiten
                                        </Button>
                                        {validation.stamm ? (
                                            <Button size="sm" variant="ghost" onClick={() => void revokeSectionValidation("stamm")}>
                                                Validierung zurückziehen
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => void validateSection("stamm")}
                                            >
                                                <ShieldCheckIcon />Validieren
                                            </Button>
                                        )}
                                        {canViewClinical ? (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => {
                                                    setShowEditPatient(false);
                                                    setPatientDeleteOpen(true);
                                                }}
                                            >
                                                Akte löschen
                                            </Button>
                                        ) : null}
                                    </div>
                                )}
                            />
                            <dl style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[
                                    ["Geburtsdatum", formatDate(patient.geburtsdatum)],
                                    ["Geschlecht", patient.geschlecht],
                                    ["Versicherungs-Nr.", patient.versicherungsnummer],
                                    ["Telefon", patient.telefon || "–"],
                                    ["E-Mail", patient.email || "–"],
                                    ["Adresse", patient.adresse || "–"],
                                ].map(([label, value]) => (
                                    <div key={label} className="row" style={{ justifyContent: "space-between" }}>
                                        <dt style={{ color: "var(--fg-3)" }}>{label}</dt>
                                        <dd>{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Card>
                        {patientDeleteOpen && canViewClinical ? (
                            <ConfirmOrInline
                                area="patient_akte_patient_delete"
                                open={patientDeleteOpen && canViewClinical}
                                inlineId="ak-patient-delete-panel"
                                title="Löschen bestätigen"
                                message="Möchten Sie diese Patientenakte wirklich löschen? Die Akte und verknüpfte klinische Einträge werden entfernt, sofern das Backend dies zulässt."
                                onCancel={() => !patientDeleteBusy && setPatientDeleteOpen(false)}
                                onConfirm={() => void handleDeletePatient()}
                                confirmLabel="Ja, löschen"
                                danger
                                loading={patientDeleteBusy}
                            />
                        ) : null}
                        {showEditPatient ? (
                            <AkteEditFormOrInline
                                area="patient_akte_patient_edit"
                                open={showEditPatient}
                                onClose={() => setShowEditPatient(false)}
                                title="Patient bearbeiten"
                                subtitle="Änderungen gelten für die Stammdaten dieses Patienten."
                                inlineId="ak-patient-edit-panel"
                                ariaLabel="Patient bearbeiten"
                                presentationOverride="modal"
                                footer={(
                                    <>
                                        <Button type="button" variant="ghost" onClick={() => setShowEditPatient(false)}>
                                            Abbrechen
                                        </Button>
                                        <Button type="button" onClick={() => void runSavePatient()} disabled={!editForm.name.trim()}>
                                            Speichern
                                        </Button>
                                    </>
                                )}
                            >
                                <Input id="ed-name" label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                <Input id="ed-tel" label="Telefon" value={editForm.telefon} onChange={(e) => setEditForm({ ...editForm, telefon: e.target.value })} />
                                <Input id="ed-mail" label="E-Mail" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                                <Textarea id="ed-addr" label="Adresse" value={editForm.adresse} onChange={(e) => setEditForm({ ...editForm, adresse: e.target.value })} />
                            </AkteEditFormOrInline>
                        ) : null}
                    </div>
                </div>
            )}

            {activeTab === "anam" && canViewClinical && (
                <div id="panel-anam" role="tabpanel" aria-labelledby="tab-anam">
                    <div className="col" style={{ gap: 16 }}>
                        <Card className="card-pad">
                            <CardHeader
                                title="Anamnese"
                                subtitle={
                                    validation.stamm
                                        ? `Gilt mit Stammdaten als geprüft · ${formatDateTime(validation.stamm.validatedAt)}`
                                        : anamEditing
                                            ? "Bearbeitung aktiv — Änderungen mit „Speichern“ übernehmen. Prüfung erfolgt unter „Stammdaten“."
                                            : "Ansicht: Felder sind gesperrt. Über „Bearbeiten“ freischalten. Die ärztliche Bestätigung erfolgt im Reiter „Stammdaten“."
                                }
                                action={(
                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                        {!anamEditing ? (
                                            <Button size="sm" variant="secondary" type="button" onClick={() => setAnamEditing(true)}>
                                                Bearbeiten
                                            </Button>
                                        ) : (
                                            <>
                                                <Button size="sm" variant="ghost" type="button" onClick={() => cancelAnamneseEdit()}>
                                                    Abbrechen
                                                </Button>
                                                <Button size="sm" type="button" onClick={() => void runSaveAnamnese()}>
                                                    Speichern
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}
                            />
                            <label
                                className="row"
                                style={{
                                    marginBottom: 14,
                                    gap: 8,
                                    alignItems: "center",
                                    opacity: anamEditing ? 1 : 0.65,
                                    cursor: anamEditing ? "pointer" : "default",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={anamneseSign}
                                    disabled={!anamEditing}
                                    onChange={(e) => setAnamneseSign(e.target.checked)}
                                />
                                <span style={{ fontSize: 13 }}>Patientenunterschrift vorhanden</span>
                            </label>
                            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.45 }}>
                                Die wichtigsten Angaben erfassen Sie in den Feldern unten; die Akkordeons zeigen die zusammengeführte Übersicht (inkl. weiterer Abschnitte nach dem Speichern).
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
                                <Input
                                    id="anam-vs"
                                    label="Versicherungsstatus"
                                    value={anamQuick.versicherungsstatus}
                                    disabled={!anamEditing}
                                    onChange={(e) => setAnamQuick({ ...anamQuick, versicherungsstatus: e.target.value })}
                                    placeholder="z. B. GKV, PKV, Selbstzahler"
                                />
                                <Input
                                    id="anam-kk"
                                    label="Krankenkasse / Versicherer"
                                    value={anamQuick.krankenkasse}
                                    disabled={!anamEditing}
                                    onChange={(e) => setAnamQuick({ ...anamQuick, krankenkasse: e.target.value })}
                                />
                                <Textarea
                                    id="anam-chron"
                                    label="Chronische Erkrankungen"
                                    value={anamQuick.chronisch}
                                    disabled={!anamEditing}
                                    onChange={(e) => setAnamQuick({ ...anamQuick, chronisch: e.target.value })}
                                    rows={2}
                                />
                                <Textarea
                                    id="anam-all"
                                    label="Medikamentenallergien"
                                    value={anamQuick.allergienMed}
                                    disabled={!anamEditing}
                                    onChange={(e) => setAnamQuick({ ...anamQuick, allergienMed: e.target.value })}
                                    rows={2}
                                />
                            </div>
                            {parsedAnamnesePreview ? (
                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                                    <div style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--fg-3)", textTransform: "uppercase", marginBottom: 10 }}>
                                        Übersicht
                                    </div>
                                    <AnamneseVisual data={parsedAnamnesePreview} />
                                </div>
                            ) : (
                                <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                    Keine strukturierte Vorschau — bitte Erfassung speichern.
                                </p>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === "unter" && canViewClinical && (
                <div id="panel-unter" role="tabpanel" aria-labelledby="tab-unter">
                    <div className="col" style={{ gap: 16 }}>
                        <Card className="card-pad">
                            <CardHeader
                                title="Untersuchungen"
                                action={(
                                    <Button
                                        size="sm"
                                        disabled={showUnterComposer}
                                        onClick={() => {
                                            setUnterEdit(null);
                                            setUnterDeleteId(null);
                                            setShowUnterComposer(true);
                                        }}
                                    >
                                        {showUnterComposer ? "Erfassung aktiv…" : "Neue Untersuchung"}
                                    </Button>
                                )}
                            />
                            {untersuchungen.length === 0 ? (
                                <p style={{ color: "var(--fg-3)" }}>Keine Untersuchungen.</p>
                            ) : (
                                <div className="col unter-stack" style={{ gap: 8 }}>
                                    {untersuchungen.flatMap((u) => {
                                        const detail = parseUntersuchungV1(u.ergebnisse);
                                        const open = unterDetailId === u.id;
                                        const entryCard = (
                                            <div key={u.id} className="card" style={{ padding: 12 }}>
                                                <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                                    <div className="col" style={{ gap: 2, minWidth: 0 }}>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                            {(u.untersuchungsnummer ?? "").trim()
                                                                ? `U ${(u.untersuchungsnummer ?? "").trim()}`
                                                                : "U —"}
                                                            {" · "}
                                                            {formatDateTime(u.created_at)}
                                                        </div>
                                                        <div style={{ fontWeight: 600 }}>{u.diagnose || detail?.diagnosis || "Diagnose offen"}</div>
                                                        <div style={{ color: "var(--fg-3)", fontSize: 13 }}>{u.beschwerden || detail?.chiefComplaint || "—"}</div>
                                                    </div>
                                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setUnterDetailId(open ? null : u.id)}
                                                        >
                                                            {open ? "Detail schließen" : "Detail anzeigen"}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setUnterDeleteId(null);
                                                                setShowUnterComposer(false);
                                                                setUnterEditUnlocked(false);
                                                                setUnterEdit({ ...u });
                                                            }}
                                                        >
                                                            Bearbeiten
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => {
                                                                setUnterEdit(null);
                                                                setUnterDeleteId(u.id);
                                                            }}
                                                        >
                                                            Löschen
                                                        </Button>
                                                    </div>
                                                </div>
                                                {open ? (
                                                    detail ? (
                                                        <div
                                                            className="untersuchung-detail-sheet"
                                                            style={{
                                                                marginTop: 14,
                                                                border: "1px solid var(--line)",
                                                                borderRadius: 12,
                                                                overflow: "hidden",
                                                                background: "var(--surface)",
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    padding: "14px 16px",
                                                                    background: "var(--accent-soft)",
                                                                    borderBottom: "1px solid var(--line)",
                                                                }}
                                                            >
                                                                <div style={{ fontSize: 11, letterSpacing: "0.04em", color: "var(--fg-3)", textTransform: "uppercase" }}>
                                                                    Klinische Zusammenfassung
                                                                </div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>
                                                                    {detail.diagnosis || u.diagnose || "—"}
                                                                </div>
                                                                {detail.plan ? (
                                                                    <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>
                                                                        <strong>Plan:</strong> {detail.plan}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ fontSize: 13 }}>
                                                                <div style={{ padding: 14, borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>Hauptbeschwerde</div>
                                                                    <p style={{ margin: 0, whiteSpace: "pre-line" }}>{detail.chiefComplaint || "—"}</p>
                                                                    {detail.painVas ? (
                                                                        <div style={{ marginTop: 8, color: "var(--fg-3)" }}>
                                                                            VAS {detail.painVas}/10 · {detail.painLocation || "—"}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>Extraoral</div>
                                                                    <p style={{ margin: "4px 0" }}>TMG: {detail.extraoral.tmj || "—"}</p>
                                                                    <p style={{ margin: "4px 0" }}>Lymphknoten: {detail.extraoral.lymphNodes || "—"}</p>
                                                                    <p style={{ margin: "4px 0" }}>Asymmetrie: {detail.extraoral.asymmetry || "—"}</p>
                                                                </div>
                                                                <div style={{ padding: 14, borderBottom: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>Intraoral</div>
                                                                    <p style={{ margin: "4px 0" }}>Schleimhaut: {detail.intraoral.mucosa || "—"}</p>
                                                                    <p style={{ margin: "4px 0" }}>Zunge: {detail.intraoral.tongue || "—"}</p>
                                                                    <p style={{ margin: "4px 0" }}>Gingiva: {detail.intraoral.gingiva || "—"}</p>
                                                                </div>
                                                                <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>Parodontal</div>
                                                                    <p style={{ margin: "4px 0" }}>
                                                                        PSI: {Object.values(detail.psi).filter(Boolean).join(" / ") || "—"}
                                                                    </p>
                                                                    <p style={{ margin: "4px 0" }}>
                                                                        BOP {detail.bopPercent || "—"} % · PI {detail.plaqueIndex || "—"} · MH {detail.hygieneScore || "—"}
                                                                    </p>
                                                                </div>
                                                                <div style={{ padding: 14, borderRight: "1px solid var(--line)" }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>Funktion</div>
                                                                    <p style={{ margin: "4px 0" }}>CMD: {detail.function.cmd || "—"}</p>
                                                                    <p style={{ margin: "4px 0" }}>Bruxismus: {detail.function.bruxism || "—"}</p>
                                                                    <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.function.notes || ""}</p>
                                                                </div>
                                                                <div style={{ padding: 14 }}>
                                                                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>Bildgebung</div>
                                                                    <p style={{ margin: "4px 0" }}>Angeordnet: {detail.imaging.ordered || "—"}</p>
                                                                    <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.imaging.findings || "—"}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, fontSize: 12, background: "var(--bg-2, rgba(0,0,0,0.04))", padding: 12, borderRadius: 8 }}>
                                                            {u.ergebnisse || "Keine strukturierten Daten."}
                                                        </pre>
                                                    )
                                                ) : null}
                                            </div>
                                        );
                                        if (unterEdit?.id === u.id && akte) {
                                            return [
                                                <div key={`${u.id}-edit`} className="unter-stack-edit-slot">
                                                    <AkteInlineEditPanelShell
                                                        id={`ak-unter-edit-${u.id}`}
                                                        ariaLabel="Untersuchung bearbeiten"
                                                        title="Untersuchung bearbeiten"
                                                        subtitle={(
                                                            <>
                                                                {(unterEdit.untersuchungsnummer ?? "").trim()
                                                                    ? `U ${(unterEdit.untersuchungsnummer ?? "").trim()} · `
                                                                    : null}
                                                                Gleiche strukturierte Erfassung wie bei „Neue Untersuchung“ — Abschnitte per Chips wechseln.
                                                                {!unterEditUnlocked ? " Zum Ändern „Bearbeiten“ wählen." : null}
                                                            </>
                                                        )}
                                                        headerExtra={
                                                            !unterEditUnlocked ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => setUnterEditUnlocked(true)}
                                                                >
                                                                    Bearbeiten
                                                                </Button>
                                                            ) : null
                                                        }
                                                        onClose={() => setUnterEdit(null)}
                                                        rootClassName="akte-inline-panel--unter-stack-edit"
                                                    >
                                                        <UntersuchungComposer
                                                            key={unterEdit.id}
                                                            variant="edit"
                                                            locked={!unterEditUnlocked}
                                                            initialFromRecord={{
                                                                beschwerden: unterEdit.beschwerden,
                                                                ergebnisse: unterEdit.ergebnisse,
                                                                diagnose: unterEdit.diagnose,
                                                            }}
                                                            befunde={befunde}
                                                            onApplyTooth={async (tooth, statusKey) => {
                                                                await createZahnbefund({ akte_id: akte.id, zahn_nummer: tooth, befund: statusKey });
                                                                await load();
                                                            }}
                                                            onCancel={() => setUnterEdit(null)}
                                                            onSave={async (payload) => runSaveUntersuchungEdit(payload)}
                                                        />
                                                    </AkteInlineEditPanelShell>
                                                </div>,
                                                entryCard,
                                            ];
                                        }
                                        return [entryCard];
                                    })}
                                </div>
                            )}
                            {unterDeleteId ? (
                                <ConfirmOrInline
                                    area="patient_akte_untersuchung_delete"
                                    open={!!unterDeleteId}
                                    inlineId="ak-unter-delete-panel"
                                    title="Untersuchung löschen"
                                    message={(() => {
                                        const u = untersuchungen.find((x) => x.id === unterDeleteId);
                                        return u
                                            ? `Eintrag vom ${formatDateTime(u.created_at)} mit Diagnose „${u.diagnose || "—"}“ wirklich entfernen?`
                                            : "Diesen Untersuchungseintrag wirklich entfernen?";
                                    })()}
                                    onCancel={() => setUnterDeleteId(null)}
                                    onConfirm={() => void handleDeleteUntersuchungRow()}
                                    confirmLabel="Ja, löschen"
                                    danger
                                />
                            ) : null}
                            {akte && showUnterComposer ? (
                                <div className="akte-inline-panel" role="region" aria-label="Neue Untersuchung">
                                    <div className="akte-inline-panel-head">
                                        <div>
                                            <div className="akte-inline-panel-title">Neue Untersuchung</div>
                                            <div className="akte-inline-panel-sub">
                                                Vorgesehene Nummer: <strong>{nextUnterPreview}</strong>
                                                {" — "}
                                                strukturierte Erfassung, erscheint im Verlauf dieser Akte.
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowUnterComposer(false)}>
                                            Schließen
                                        </Button>
                                    </div>
                                    <div className="akte-inline-panel-body" style={{ paddingTop: 12 }}>
                                        <UntersuchungComposer
                                            befunde={befunde}
                                            onApplyTooth={async (tooth, statusKey) => {
                                                await createZahnbefund({ akte_id: akte.id, zahn_nummer: tooth, befund: statusKey });
                                                await load();
                                            }}
                                            onCancel={() => setShowUnterComposer(false)}
                                            onSave={async (payload) => {
                                                await handleCreateUntersuchung(payload);
                                            }}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </Card>
                    </div>
                </div>
            )}

            {activeTab === "behand" && canViewClinical && (
                <div id="panel-behand" role="tabpanel" aria-labelledby="tab-behand">
                    <div className="col" style={{ gap: 20 }}>
                        <Card className="card-pad">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                                <h3 className="text-title" style={{ margin: 0 }}>Behandlungen (Verlauf)</h3>
                            </div>
                            {!showBehandComposer ? (
                                <div
                                    className="row"
                                    style={{ gap: 12, flexWrap: "wrap", marginBottom: behandlungen.length === 0 ? 0 : 16 }}
                                    role="group"
                                    aria-label="Behandlung starten"
                                >
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => {
                                            const nextNr = generateNewBehandlungsnummer();
                                            setBehandDeleteId(null);
                                            setBehandEditId(null);
                                            setBehandFormUnlocked(true);
                                            setContinueFromBehandlungId("");
                                            setBehandForm({
                                                datum: new Date().toISOString().slice(0, 10),
                                                kategorie: "",
                                                leistungsname: "",
                                                leistungKatalogId: "",
                                                behandlungsnummer: nextNr,
                                                sitzung: "1",
                                                gesamtkosten: "",
                                                behandlung_status: "DURCHGEFUEHRT",
                                                termin_erforderlich: "0",
                                                notizen: "",
                                            });
                                            setSelectedBehandTooth(null);
                                            setBehandComposerMode("new");
                                            setShowBehandComposer(true);
                                            toast(`Neue Behandlung ${nextNr} (Sitzung 1) gestartet`, "success");
                                        }}
                                        style={{ minWidth: 200 }}
                                    >
                                        + Neue Behandlung
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={behandlungen.length === 0}
                                        onClick={() => {
                                            const firstId = behandlungen[0]?.id;
                                            if (!firstId) {
                                                toast("Keine Behandlung zum Fortsetzen.", "info");
                                                return;
                                            }
                                            setBehandDeleteId(null);
                                            setBehandEditId(null);
                                            setBehandFormUnlocked(true);
                                            setBehandComposerMode("continue");
                                            setShowBehandComposer(true);
                                            applyContinueFromBehandlung(firstId);
                                            toast("Behandlung fortsetzen — Ausgangs-Sitzung bei Bedarf im Dropdown wählen.", "success");
                                        }}
                                        style={{ minWidth: 200 }}
                                    >
                                        Behandlung fortsetzen
                                    </Button>
                                    <span style={{ alignSelf: "center", fontSize: 12, color: "var(--fg-3)", flexBasis: "100%" }}>
                                        Fortsetzen übernimmt Leistung aus Katalog automatisch von der gewählten Sitzung. Standard: zuletzt dokumentierte Sitzung.
                                    </span>
                                </div>
                            ) : null}
                            {showBehandComposer && !behandEditId ? (
                                <BehandlungAkteComposerPanel {...behandComposerCommon} />
                            ) : null}
                            {behandlungen.length === 0 ? (
                                <p style={{ color: "var(--fg-3)", marginTop: 4 }}>Noch keine Behandlungen.</p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table className="tbl tbl-behand-groups">
                                        <thead>
                                            <tr>
                                                <th>Datum</th>
                                                <th>Zahnnummer</th>
                                                <th>Kategorie</th>
                                                <th>Leistungsname</th>
                                                <th>Sitzung</th>
                                                <th>B.Nummer</th>
                                                <th style={{ width: 200 }}>Aktion</th>
                                            </tr>
                                        </thead>
                                        {behandlungGroups.map((grp) => (
                                            <tbody key={grp[0]?.id ?? grp.map((x) => x.id).join()} className="behand-grp">
                                                {grp.map((b) => (
                                                    <Fragment key={b.id}>
                                                        {showBehandComposer && behandEditId === b.id ? (
                                                            <tr>
                                                                <td
                                                                    colSpan={7}
                                                                    style={{
                                                                        padding: 12,
                                                                        verticalAlign: "top",
                                                                        background: "var(--bg-elev)",
                                                                    }}
                                                                >
                                                                    <BehandlungAkteComposerPanel {...behandComposerCommon} />
                                                                </td>
                                                            </tr>
                                                        ) : null}
                                                        <tr>
                                                        <td>{b.behandlung_datum ? formatDate(b.behandlung_datum) : formatDateTime(b.created_at)}</td>
                                                        <td>{b.zaehne || "—"}</td>
                                                        <td>{b.kategorie || b.art}</td>
                                                        <td>{b.leistungsname || b.beschreibung || b.art}</td>
                                                        <td>{b.sitzung != null ? `Nr. ${b.sitzung}` : "—"}</td>
                                                        <td>{b.behandlungsnummer || "—"}</td>
                                                        <td>
                                                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        setBehandDeleteId(null);
                                                                        setBehandEditId(b.id);
                                                                        setBehandFormUnlocked(false);
                                                                        setBehandComposerMode(null);
                                                                        setContinueFromBehandlungId("");
                                                                        const kid = resolveKatalogIdForBehandlung(katalog, b);
                                                                        setBehandForm({
                                                                            datum: (b.behandlung_datum ?? b.created_at).slice(0, 10),
                                                                            kategorie: b.kategorie ?? b.art ?? "",
                                                                            leistungsname: b.leistungsname ?? b.beschreibung ?? b.art ?? "",
                                                                            leistungKatalogId: kid,
                                                                            behandlungsnummer: (b.behandlungsnummer ?? "").trim(),
                                                                            sitzung: b.sitzung != null ? String(b.sitzung) : "",
                                                                            gesamtkosten: b.gesamtkosten != null ? String(b.gesamtkosten) : "",
                                                                            behandlung_status: b.behandlung_status ?? "DURCHGEFUEHRT",
                                                                            termin_erforderlich: b.termin_erforderlich === 1 ? "1" : "0",
                                                                            notizen: b.notizen ?? "",
                                                                        });
                                                                        setSelectedBehandTooth(b.zaehne ?? null);
                                                                        setShowBehandComposer(true);
                                                                    }}
                                                                >
                                                                    Bearbeiten
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="danger"
                                                                    onClick={() => {
                                                                        setShowBehandComposer(false);
                                                                        setBehandComposerMode(null);
                                                                        setBehandEditId(null);
                                                                        setBehandFormUnlocked(true);
                                                                        setContinueFromBehandlungId("");
                                                                        setBehandDeleteId(b.id);
                                                                    }}
                                                                >
                                                                    Löschen
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        ))}
                                    </table>
                                </div>
                            )}
                        </Card>

                        {behandDeleteId ? (
                            <ConfirmOrInline
                                area="patient_akte_behandlung_delete"
                                open={!!behandDeleteId}
                                inlineId="ak-behand-delete-panel"
                                title="Behandlung löschen"
                                message={(() => {
                                    const b = behandlungen.find((x) => x.id === behandDeleteId);
                                    return b
                                        ? `Die Zeile „${b.leistungsname || b.beschreibung || b.art || "—"}“ (Sitzung ${b.sitzung != null ? b.sitzung : "—"}) wirklich entfernen?`
                                        : "Diese Behandlungszeile wirklich entfernen?";
                                })()}
                                onCancel={() => setBehandDeleteId(null)}
                                onConfirm={() => void handleDeleteBehandlungRow()}
                                confirmLabel="Ja, löschen"
                                danger
                            />
                        ) : null}

                    </div>
                </div>
            )}

            {activeTab === "rezept" && (
                <div id="panel-rezept" role="tabpanel" aria-labelledby="tab-rezept">
                <Card className="card-pad">
                    <div className="akte-zahl-modus" role="tablist" aria-label="Ansicht Rezepte oder Atteste" style={{ marginBottom: 16 }}>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={rezeptAttestSub === "rezept"}
                            className={`akte-zahl-modus__btn${rezeptAttestSub === "rezept" ? " is-active" : ""}`}
                            onClick={() => {
                                setRezeptAttestSub("rezept");
                                resetAttestWizard();
                                setAttestDeleteId(null);
                            }}
                        >
                            Rezept
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={rezeptAttestSub === "attest"}
                            className={`akte-zahl-modus__btn${rezeptAttestSub === "attest" ? " is-active" : ""}`}
                            onClick={() => {
                                setRezeptAttestSub("attest");
                                resetRezeptWizard();
                                setRezeptEdit(null);
                                setRezeptDeleteId(null);
                            }}
                        >
                            Atteste
                        </button>
                    </div>
                    {rezeptAttestSub === "rezept" ? (
                    <>
                    <CardHeader
                        title="Rezepte"
                        subtitle="Vordefiniertes oder neues Rezept: die Eingabe öffnet sich direkt unter der Liste — ohne separates Fenster."
                        action={canWriteMedical ? (
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={openRezeptPick} disabled={!id}>
                                    Vordefiniertes Rezept
                                </Button>
                                <Button type="button" size="sm" onClick={openRezeptNeu} disabled={!id}>
                                    <PlusIcon /> Neues Rezept
                                </Button>
                            </div>
                        ) : null}
                    />
                    {!canWriteMedical ? (
                        <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                            Rezepte können nur von Berechtigten mit ärztlicher Freigabe angelegt oder geändert werden. Die Liste ist einsehbar, sofern Ihre Rolle Zugriff auf die Akte hat.
                        </p>
                    ) : null}

                    <FormSection title="Rezeptliste dieser Akte">
                        {rezepte.length === 0 ? (
                            <EmptyState
                                icon="💊"
                                title="Keine Rezepte in dieser Akte"
                                description={canWriteMedical
                                    ? "Nutzen Sie die Buttons oben — der Assistent erscheint unter dieser Liste."
                                    : "Für diese Akte wurden noch keine Rezepte erfasst."}
                                action={canWriteMedical && id
                                    ? { label: "Neues Rezept", onClick: openRezeptNeu }
                                    : undefined}
                            />
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="tbl">
                                    <thead>
                                        <tr>
                                            <th>Medikament</th>
                                            <th>Dosierung</th>
                                            <th>Dauer</th>
                                            <th>Status</th>
                                            <th>Ausgestellt</th>
                                            <th style={{ minWidth: 200 }}>Aktion</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rezepte.map((r) => {
                                            const st = rezeptStatusDisplay(r.status);
                                            const showEditRow =
                                                canWriteMedical && rezeptEdit?.id === r.id && !rezeptWizardStep;
                                            return (
                                                <Fragment key={r.id}>
                                                    {showEditRow ? (
                                                        <tr>
                                                            <td
                                                                colSpan={6}
                                                                style={{
                                                                    padding: 12,
                                                                    verticalAlign: "top",
                                                                    background: "var(--bg-elev)",
                                                                }}
                                                            >
                                                                <AkteEditFormOrInline
                                                                    area="patient_akte_rezept_edit"
                                                                    open={canWriteMedical && !!rezeptEdit && !rezeptWizardStep}
                                                                    onClose={() => setRezeptEdit(null)}
                                                                    title="Rezept bearbeiten"
                                                                    subtitle={
                                                                        rezeptEditUnlocked
                                                                            ? "Änderungen gelten nur für diese Zeile in der Akte."
                                                                            : "Ansicht — Felder sind gesperrt. „Bearbeiten“ wählen zum Ändern."
                                                                    }
                                                                    inlineId={`ak-rezept-edit-inline-${r.id}`}
                                                                    ariaLabel="Rezept bearbeiten"
                                                                    panelVariant="rezept"
                                                                    presentationOverride="inline"
                                                                    headerExtra={
                                                                        !rezeptEditUnlocked ? (
                                                                            <Button
                                                                                type="button"
                                                                                variant="secondary"
                                                                                size="sm"
                                                                                onClick={() => setRezeptEditUnlocked(true)}
                                                                            >
                                                                                Bearbeiten
                                                                            </Button>
                                                                        ) : null
                                                                    }
                                                                    footer={(
                                                                        <>
                                                                            <Button type="button" variant="ghost" onClick={() => setRezeptEdit(null)}>
                                                                                Abbrechen
                                                                            </Button>
                                                                            <Button
                                                                                type="button"
                                                                                onClick={() => void runSaveRezeptEdit()}
                                                                                disabled={
                                                                                    !rezeptEditUnlocked
                                                                                    || !rezeptEditForm.medikament.trim()
                                                                                    || !rezeptEditForm.dosierung.trim()
                                                                                    || !rezeptEditForm.dauer.trim()
                                                                                }
                                                                            >
                                                                                Speichern
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                >
                                                                    <Input
                                                                        id={`rex-med-${r.id}`}
                                                                        label="Medikament *"
                                                                        value={rezeptEditForm.medikament}
                                                                        disabled={!rezeptEditUnlocked}
                                                                        onChange={(e) =>
                                                                            setRezeptEditForm({
                                                                                ...rezeptEditForm,
                                                                                medikament: e.target.value,
                                                                            })}
                                                                    />
                                                                    <Input
                                                                        id={`rex-wirk-${r.id}`}
                                                                        label="Wirkstoff"
                                                                        value={rezeptEditForm.wirkstoff}
                                                                        disabled={!rezeptEditUnlocked}
                                                                        onChange={(e) =>
                                                                            setRezeptEditForm({
                                                                                ...rezeptEditForm,
                                                                                wirkstoff: e.target.value,
                                                                            })}
                                                                    />
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                        <Input
                                                                            id={`rex-dos-${r.id}`}
                                                                            label="Dosierung *"
                                                                            value={rezeptEditForm.dosierung}
                                                                            disabled={!rezeptEditUnlocked}
                                                                            onChange={(e) =>
                                                                                setRezeptEditForm({
                                                                                    ...rezeptEditForm,
                                                                                    dosierung: e.target.value,
                                                                                })}
                                                                        />
                                                                        <Input
                                                                            id={`rex-dauer-${r.id}`}
                                                                            label="Dauer *"
                                                                            value={rezeptEditForm.dauer}
                                                                            disabled={!rezeptEditUnlocked}
                                                                            onChange={(e) =>
                                                                                setRezeptEditForm({
                                                                                    ...rezeptEditForm,
                                                                                    dauer: e.target.value,
                                                                                })}
                                                                        />
                                                                    </div>
                                                                    <Textarea
                                                                        id={`rex-hin-${r.id}`}
                                                                        label="Hinweise"
                                                                        rows={2}
                                                                        value={rezeptEditForm.hinweise}
                                                                        disabled={!rezeptEditUnlocked}
                                                                        onChange={(e) =>
                                                                            setRezeptEditForm({
                                                                                ...rezeptEditForm,
                                                                                hinweise: e.target.value,
                                                                            })}
                                                                    />
                                                                </AkteEditFormOrInline>
                                                            </td>
                                                        </tr>
                                                    ) : null}
                                                    <tr>
                                                        <td style={{ fontWeight: 600 }}>{r.medikament}</td>
                                                        <td>{r.dosierung}</td>
                                                        <td>{r.dauer}</td>
                                                        <td><Badge variant={st.variant}>{st.label}</Badge></td>
                                                        <td>{formatDate(r.ausgestellt_am)}</td>
                                                        <td>
                                                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    type="button"
                                                                    onClick={() => handlePrintRezept(r)}
                                                                >
                                                                    Exportieren…
                                                                </Button>
                                                                {canWriteMedical ? (
                                                                    <>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            onClick={() => {
                                                                                setRezeptDeleteId(null);
                                                                                resetRezeptWizard();
                                                                                setRezeptEditUnlocked(false);
                                                                                setRezeptEditForm({
                                                                                    medikament: r.medikament,
                                                                                    wirkstoff: r.wirkstoff ?? "",
                                                                                    dosierung: r.dosierung,
                                                                                    dauer: r.dauer,
                                                                                    hinweise: r.hinweise ?? "",
                                                                                });
                                                                                setRezeptEdit(r);
                                                                            }}
                                                                        >
                                                                            Bearbeiten
                                                                        </Button>
                                                                        <Button
                                                                            variant="danger"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                resetRezeptWizard();
                                                                                setRezeptEdit(null);
                                                                                setRezeptDeleteId(r.id);
                                                                            }}
                                                                        >
                                                                            Löschen
                                                                        </Button>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {canWriteMedical && rezeptDeleteId ? (
                            <ConfirmOrInline
                                area="patient_akte_rezept_delete"
                                open={canWriteMedical && !!rezeptDeleteId}
                                inlineId="ak-rezept-delete-panel"
                                title="Rezept löschen"
                                message={(() => {
                                    const r = rezepte.find((x) => x.id === rezeptDeleteId);
                                    return r
                                        ? `Das Rezept „${r.medikament}“ (${r.dosierung}, ${r.dauer}) wirklich löschen?`
                                        : "Dieses Rezept wirklich löschen?";
                                })()}
                                onCancel={() => setRezeptDeleteId(null)}
                                onConfirm={() => void handleDeleteRezept()}
                                confirmLabel="Ja, löschen"
                                danger
                            />
                        ) : null}

                        {canWriteMedical && rezeptWizardStep ? (
                            <div
                                ref={rezeptWizardPanelRef}
                                id="ak-rezept-wizard-panel"
                                className="rezept-akte-panel"
                                role="region"
                                aria-label="Rezept erfassen"
                            >
                                <div className="rezept-akte-panel-head">
                                    <div>
                                        <div className="rezept-akte-panel-title">
                                            {rezeptWizardStep === "pick" ? "Vordefiniertes Rezept wählen" : null}
                                            {rezeptWizardStep === "compose"
                                                ? (rezeptComposerKind === "vorlage" ? "Rezept aus Vorlage" : "Neues Rezept")
                                                : null}
                                            {rezeptWizardStep === "ask_vorlage" ? "Als Praxis-Vorlage speichern?" : null}
                                            {rezeptWizardStep === "name_vorlage" ? "Name der neuen Vorlage" : null}
                                        </div>
                                        {rezeptWizardStep === "pick" ? (
                                            <div className="rezept-akte-panel-sub">
                                                Namen eingeben oder aus der Liste wählen. Anschließend können Sie die Zeilen anpassen — die Praxis-Vorlage selbst bleibt unverändert.
                                            </div>
                                        ) : null}
                                        {rezeptWizardStep === "compose" ? (
                                            <div className="rezept-akte-panel-sub">
                                                Zeilen ergänzen oder bearbeiten, dann für den Patienten speichern.
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (!rezeptComposerBusy) resetRezeptWizard();
                                        }}
                                        disabled={rezeptComposerBusy}
                                    >
                                        Schließen
                                    </Button>
                                </div>

                                <div className="rezept-akte-panel-body">
                                    {rezeptWizardStep === "pick" ? (
                                        <>
                                            <datalist id="ak-rezept-vorlagen-dl">
                                                {rezeptVorlagen.map((v) => (
                                                    <option key={v.id} value={v.titel} />
                                                ))}
                                            </datalist>
                                            <Input
                                                id="ak-rz-pick-q"
                                                label="Vorlage suchen"
                                                list="ak-rezept-vorlagen-dl"
                                                value={rezeptPickQuery}
                                                onChange={(e) => {
                                                    setRezeptPickQuery(e.target.value);
                                                    setRezeptPickSelectedId("");
                                                }}
                                                placeholder="Titel tippen…"
                                            />
                                            <div
                                                style={{
                                                    maxHeight: 200,
                                                    overflowY: "auto",
                                                    marginTop: 8,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 4,
                                                }}
                                            >
                                                {rezeptPickFiltered.length === 0 ? (
                                                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                        Keine Treffer — andere Schreibweise oder unter Verwaltung → Vorlagen anlegen.
                                                    </span>
                                                ) : (
                                                    rezeptPickFiltered.slice(0, 24).map((v) => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            className="btn btn-subtle btn-sm"
                                                            style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                            onClick={() => {
                                                                setRezeptPickSelectedId(v.id);
                                                                setRezeptPickQuery(v.titel);
                                                            }}
                                                        >
                                                            {v.titel}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    ) : null}

                                    {rezeptWizardStep === "compose" ? (
                                        <>
                                            {rezeptComposerKind === "vorlage" && rezeptListeGeaendert ? (
                                                <p
                                                    style={{
                                                        fontSize: 12.5,
                                                        marginTop: 0,
                                                        marginBottom: 12,
                                                        padding: "8px 10px",
                                                        borderRadius: 8,
                                                        background: "var(--accent-soft)",
                                                        color: "var(--accent-ink)",
                                                    }}
                                                >
                                                    Sie haben die Vorlage geändert — es handelt sich um eine <strong>neue Liste</strong> für diesen Patienten. Die hinterlegte Praxis-Vorlage wird nicht überschrieben.
                                                </p>
                                            ) : null}
                                            {rezeptLines.length > 0 ? (
                                                <div style={{ overflowX: "auto", marginBottom: 12 }}>
                                                    <table className="tbl">
                                                        <thead>
                                                            <tr>
                                                                <th>Medikament</th>
                                                                <th>Wirkstoff</th>
                                                                <th>Dosierung</th>
                                                                <th>Dauer</th>
                                                                <th>Hinweise</th>
                                                                <th />
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {rezeptLines.map((ln, i) => (
                                                                <tr key={`${i}-${ln.medikament}`}>
                                                                    <td>
                                                                        <Input
                                                                            label=""
                                                                            value={ln.medikament}
                                                                            onChange={(e) => patchRezeptLine(i, { medikament: e.target.value })}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <Input
                                                                            label=""
                                                                            value={ln.wirkstoff}
                                                                            onChange={(e) => patchRezeptLine(i, { wirkstoff: e.target.value })}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <Input
                                                                            label=""
                                                                            value={ln.dosierung}
                                                                            onChange={(e) => patchRezeptLine(i, { dosierung: e.target.value })}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <Input
                                                                            label=""
                                                                            value={ln.dauer}
                                                                            onChange={(e) => patchRezeptLine(i, { dauer: e.target.value })}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <Input
                                                                            label=""
                                                                            value={ln.hinweise}
                                                                            onChange={(e) => patchRezeptLine(i, { hinweise: e.target.value })}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => setRezeptLines((prev) => prev.filter((_, j) => j !== i))}
                                                                        >
                                                                            Entfernen
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : null}

                                            <datalist id="ak-rezept-med-dl">
                                                {MEDIKAMENT_SUGGESTIONS.map((s) => (
                                                    <option key={s.label} value={s.label} />
                                                ))}
                                            </datalist>
                                            <div
                                                style={{
                                                    border: "1px solid var(--line)",
                                                    borderRadius: 10,
                                                    padding: 12,
                                                    background: "rgba(0,0,0,0.02)",
                                                    marginBottom: 12,
                                                }}
                                            >
                                                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Weitere Zeile</div>
                                                {rezeptDraftErr ? (
                                                    <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{rezeptDraftErr}</p>
                                                ) : null}
                                                <Input
                                                    id="ak-rz-d-med"
                                                    label="Medikament *"
                                                    list="ak-rezept-med-dl"
                                                    value={rezeptDraft.medikament}
                                                    onChange={(e) => pickMedForRezeptDraft(e.target.value)}
                                                    placeholder="z. B. Ibuprofen 600 mg"
                                                />
                                                <Input
                                                    id="ak-rz-d-wirk"
                                                    label="Wirkstoff"
                                                    value={rezeptDraft.wirkstoff}
                                                    onChange={(e) => setRezeptDraft({ ...rezeptDraft, wirkstoff: e.target.value })}
                                                />
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <Input
                                                        id="ak-rz-d-dos"
                                                        label="Dosierung *"
                                                        value={rezeptDraft.dosierung}
                                                        onChange={(e) => setRezeptDraft({ ...rezeptDraft, dosierung: e.target.value })}
                                                    />
                                                    <Input
                                                        id="ak-rz-d-dauer"
                                                        label="Dauer *"
                                                        value={rezeptDraft.dauer}
                                                        onChange={(e) => setRezeptDraft({ ...rezeptDraft, dauer: e.target.value })}
                                                    />
                                                </div>
                                                <Textarea
                                                    id="ak-rz-d-hin"
                                                    label="Hinweise (Zeile)"
                                                    rows={2}
                                                    value={rezeptDraft.hinweise}
                                                    onChange={(e) => setRezeptDraft({ ...rezeptDraft, hinweise: e.target.value })}
                                                />
                                                <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                                    <Button type="button" size="sm" variant="secondary" onClick={addRezeptDraftLine}>
                                                        Zeile übernehmen
                                                    </Button>
                                                </div>
                                            </div>

                                            <Textarea
                                                id="ak-rz-shared"
                                                label="Allgemeine Hinweise (alle Zeilen)"
                                                rows={2}
                                                value={rezeptSharedNotes}
                                                onChange={(e) => setRezeptSharedNotes(e.target.value)}
                                            />
                                        </>
                                    ) : null}

                                    {rezeptWizardStep === "ask_vorlage" ? (
                                        <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                            <strong>Ja:</strong> zusätzlich eine wiederverwendbare Praxis-Vorlage anlegen (Name im nächsten Schritt).
                                            {" "}
                                            <strong>Nein:</strong> nur die Rezepte für diesen Patienten speichern.
                                        </p>
                                    ) : null}

                                    {rezeptWizardStep === "name_vorlage" ? (
                                        <Input
                                            id="ak-rz-vorlage-name"
                                            label="Bezeichnung der Vorlage"
                                            value={rezeptNewVorlageTitel}
                                            onChange={(e) => setRezeptNewVorlageTitel(e.target.value)}
                                            placeholder="z. B. Post-OP Schmerztherapie"
                                        />
                                    ) : null}
                                </div>

                                <div className="rezept-akte-panel-actions">
                                    {rezeptWizardStep === "pick" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={() => resetRezeptWizard()}>
                                                Abbrechen
                                            </Button>
                                            <Button type="button" onClick={proceedRezeptPick}>
                                                Weiter
                                            </Button>
                                        </>
                                    ) : null}
                                    {rezeptWizardStep === "compose" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={() => resetRezeptWizard()} disabled={rezeptComposerBusy}>
                                                Abbrechen
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => void submitRezeptComposer()}
                                                loading={rezeptComposerBusy}
                                                disabled={rezeptComposerBusy}
                                            >
                                                Rezept(e) für Patient speichern
                                            </Button>
                                        </>
                                    ) : null}
                                    {rezeptWizardStep === "ask_vorlage" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={onRezeptAskVorlageNo}>
                                                Nein
                                            </Button>
                                            <Button type="button" onClick={onRezeptAskVorlageYes}>
                                                Ja
                                            </Button>
                                        </>
                                    ) : null}
                                    {rezeptWizardStep === "name_vorlage" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={onRezeptNameVorlageSkip} disabled={rezeptComposerBusy}>
                                                Abbrechen
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => onRezeptNameVorlageSave()}
                                                loading={rezeptComposerBusy}
                                                disabled={rezeptComposerBusy}
                                            >
                                                Vorlage anlegen und Rezepte speichern
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                    </FormSection>
                    </>
                    ) : (
                    <>
                    <CardHeader
                        title="Atteste"
                        subtitle="Wie bei den Rezepten: vordefinierte Praxis-Vorlage wählen oder neu erfassen — der Assistent erscheint unter der Liste."
                        action={canWriteMedical ? (
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={openAttestPick} disabled={!id}>
                                    Vordefiniertes Attest
                                </Button>
                                <Button type="button" size="sm" onClick={openAttestNeu} disabled={!id}>
                                    <PlusIcon /> Neues Attest
                                </Button>
                            </div>
                        ) : null}
                    />
                    {!canWriteMedical ? (
                        <p className="text-body" style={{ color: "var(--fg-3)", marginBottom: 16 }}>
                            Atteste können nur von Berechtigten mit ärztlicher Freigabe angelegt oder gelöscht werden. Die Liste ist einsehbar, sofern Ihre Rolle Zugriff auf die Akte hat.
                        </p>
                    ) : null}

                    <FormSection title="Attestliste dieser Akte">
                        {atteste.length === 0 ? (
                            <EmptyState
                                icon="📄"
                                title="Keine Atteste in dieser Akte"
                                description={canWriteMedical
                                    ? "Nutzen Sie die Buttons oben — der Assistent erscheint unter dieser Liste."
                                    : "Für diese Akte wurden noch keine Atteste erfasst."}
                                action={canWriteMedical && id
                                    ? { label: "Neues Attest", onClick: openAttestNeu }
                                    : undefined}
                            />
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="tbl">
                                    <thead>
                                        <tr>
                                            <th>Typ</th>
                                            <th>Gültig von</th>
                                            <th>Gültig bis</th>
                                            <th>Ausgestellt</th>
                                            <th style={{ minWidth: 200 }}>Aktion</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {atteste.map((a) => (
                                            <tr key={a.id}>
                                                <td style={{ fontWeight: 600 }}>{a.typ}</td>
                                                <td>{formatDate(a.gueltig_von)}</td>
                                                <td>{formatDate(a.gueltig_bis)}</td>
                                                <td>{formatDate(a.ausgestellt_am)}</td>
                                                <td>
                                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                                        <Button type="button" size="sm" variant="secondary" onClick={() => handlePrintAttest(a)}>
                                                            Exportieren…
                                                        </Button>
                                                        {canWriteMedical ? (
                                                            <Button
                                                                type="button"
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => {
                                                                    resetAttestWizard();
                                                                    setAttestDeleteId(a.id);
                                                                }}
                                                            >
                                                                Löschen
                                                            </Button>
                                                        ) : (
                                                            <span style={{ fontSize: 12, color: "var(--fg-3)" }}>—</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {canWriteMedical && attestDeleteId ? (
                            <ConfirmOrInline
                                area="patient_akte_attest_delete"
                                open={canWriteMedical && !!attestDeleteId}
                                inlineId="ak-attest-delete-panel"
                                title="Attest löschen"
                                message={(() => {
                                    const a = atteste.find((x) => x.id === attestDeleteId);
                                    return a
                                        ? `Das Attest „${a.typ}“ (gültig ${formatDate(a.gueltig_von)} – ${formatDate(a.gueltig_bis)}) wirklich löschen?`
                                        : "Dieses Attest wirklich löschen?";
                                })()}
                                onCancel={() => setAttestDeleteId(null)}
                                onConfirm={() => void handleDeleteAttest()}
                                confirmLabel="Ja, löschen"
                                danger
                            />
                        ) : null}

                        {canWriteMedical && attestWizardStep ? (
                            <div
                                ref={attestWizardPanelRef}
                                id="ak-attest-wizard-panel"
                                className="rezept-akte-panel"
                                role="region"
                                aria-label="Attest erfassen"
                            >
                                <div className="rezept-akte-panel-head">
                                    <div>
                                        <div className="rezept-akte-panel-title">
                                            {attestWizardStep === "pick" ? "Vordefiniertes Attest wählen" : null}
                                            {attestWizardStep === "compose"
                                                ? (attestComposerKind === "vorlage" ? "Attest aus Vorlage" : "Neues Attest")
                                                : null}
                                            {attestWizardStep === "ask_vorlage" ? "Als Praxis-Vorlage speichern?" : null}
                                            {attestWizardStep === "name_vorlage" ? "Name der neuen Vorlage" : null}
                                        </div>
                                        {attestWizardStep === "pick" ? (
                                            <div className="rezept-akte-panel-sub">
                                                Namen eingeben oder aus der Liste wählen. Anschließend können Sie Text und Zeitraum anpassen — die Praxis-Vorlage selbst bleibt unverändert.
                                            </div>
                                        ) : null}
                                        {attestWizardStep === "compose" ? (
                                            <div className="rezept-akte-panel-sub">
                                                Inhalt prüfen, Gültigkeit anpassen, dann für den Patienten speichern.
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            if (!attestComposerBusy) resetAttestWizard();
                                        }}
                                        disabled={attestComposerBusy}
                                    >
                                        Schließen
                                    </Button>
                                </div>

                                <div className="rezept-akte-panel-body">
                                    {attestWizardStep === "pick" ? (
                                        <>
                                            <datalist id="ak-attest-vorlagen-dl">
                                                {attestVorlagen.map((v) => (
                                                    <option key={v.id} value={v.titel} />
                                                ))}
                                            </datalist>
                                            <Input
                                                id="ak-att-pick-q"
                                                label="Vorlage suchen"
                                                list="ak-attest-vorlagen-dl"
                                                value={attestPickQuery}
                                                onChange={(e) => {
                                                    setAttestPickQuery(e.target.value);
                                                    setAttestPickSelectedId("");
                                                }}
                                                placeholder="Titel tippen…"
                                            />
                                            <div
                                                style={{
                                                    maxHeight: 200,
                                                    overflowY: "auto",
                                                    marginTop: 8,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 4,
                                                }}
                                            >
                                                {attestPickFiltered.length === 0 ? (
                                                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                                        Keine Treffer — unter Verwaltung → Vorlagen (Rezepte und Atteste) anlegen.
                                                    </span>
                                                ) : (
                                                    attestPickFiltered.slice(0, 24).map((v) => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            className="btn btn-subtle btn-sm"
                                                            style={{ justifyContent: "flex-start", textAlign: "left" }}
                                                            onClick={() => {
                                                                setAttestPickSelectedId(v.id);
                                                                setAttestPickQuery(v.titel);
                                                            }}
                                                        >
                                                            {v.titel}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    ) : null}

                                    {attestWizardStep === "compose" ? (
                                        <>
                                            {attestComposerKind === "vorlage" && attestListeGeaendert ? (
                                                <p
                                                    style={{
                                                        fontSize: 12.5,
                                                        marginTop: 0,
                                                        marginBottom: 12,
                                                        padding: "8px 10px",
                                                        borderRadius: 8,
                                                        background: "var(--accent-soft)",
                                                        color: "var(--accent-ink)",
                                                    }}
                                                >
                                                    Sie haben die Vorlage angepasst — es handelt sich um ein <strong>neues Attest</strong> für diesen Patienten. Die hinterlegte Praxis-Vorlage wird nicht überschrieben.
                                                </p>
                                            ) : null}
                                            {attestDraftErr ? (
                                                <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 12px" }}>{attestDraftErr}</p>
                                            ) : null}
                                            <Select
                                                id="ak-att-typ"
                                                label="Attesttyp *"
                                                value={attestForm.typ}
                                                onChange={(e) => setAttestForm({ ...attestForm, typ: e.target.value })}
                                                options={[...ATTEST_TYP_OPTIONS]}
                                            />
                                            <datalist id="ak-attest-krank-dl">
                                                {KRANKHEITEN_SUGGESTIONS.map((k) => (
                                                    <option key={k} value={k} />
                                                ))}
                                            </datalist>
                                            <Input
                                                id="ak-att-krank"
                                                label="Diagnose / Befund *"
                                                list="ak-attest-krank-dl"
                                                value={attestForm.krankheiten}
                                                onChange={(e) => setAttestForm({ ...attestForm, krankheiten: e.target.value })}
                                                placeholder="Frei eingeben oder aus Vorschlägen wählen"
                                            />
                                            <Input
                                                id="ak-att-tage"
                                                label="Anzahl der Tage *"
                                                type="number"
                                                min={1}
                                                max={366}
                                                inputMode="numeric"
                                                value={attestForm.tageAnzahl}
                                                onChange={(e) => {
                                                    const tage = e.target.value;
                                                    setAttestForm((p) => ({
                                                        ...p,
                                                        tageAnzahl: tage,
                                                        gueltig_bis: attestGueltigBisFromVonAndTage(p.gueltig_von, tage),
                                                    }));
                                                }}
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <Input
                                                    id="ak-att-von"
                                                    type="date"
                                                    label="Gültig von *"
                                                    value={attestForm.gueltig_von}
                                                    onChange={(e) => {
                                                        const von = e.target.value;
                                                        setAttestForm((p) => ({
                                                            ...p,
                                                            gueltig_von: von,
                                                            gueltig_bis: attestGueltigBisFromVonAndTage(von, p.tageAnzahl),
                                                        }));
                                                    }}
                                                />
                                                <Input
                                                    id="ak-att-bis"
                                                    type="date"
                                                    label="Gültig bis *"
                                                    value={attestForm.gueltig_bis}
                                                    onChange={(e) => setAttestForm({ ...attestForm, gueltig_bis: e.target.value })}
                                                />
                                            </div>
                                            <Textarea
                                                id="ak-att-ein"
                                                label="Empfohlene Tätigkeitseinschränkung"
                                                rows={4}
                                                value={attestForm.einschraenkung}
                                                onChange={(e) => setAttestForm({ ...attestForm, einschraenkung: e.target.value })}
                                            />
                                        </>
                                    ) : null}

                                    {attestWizardStep === "ask_vorlage" ? (
                                        <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                            <strong>Ja:</strong> zusätzlich eine wiederverwendbare Praxis-Vorlage anlegen (Name im nächsten Schritt).
                                            {" "}
                                            <strong>Nein:</strong> nur das Attest für diesen Patienten speichern.
                                        </p>
                                    ) : null}

                                    {attestWizardStep === "name_vorlage" ? (
                                        <Input
                                            id="ak-att-vorlage-name"
                                            label="Bezeichnung der Vorlage"
                                            value={attestNewVorlageTitel}
                                            onChange={(e) => setAttestNewVorlageTitel(e.target.value)}
                                            placeholder="z. B. Standard AU nach Extraktion"
                                        />
                                    ) : null}
                                </div>

                                <div className="rezept-akte-panel-actions">
                                    {attestWizardStep === "pick" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={() => resetAttestWizard()}>
                                                Abbrechen
                                            </Button>
                                            <Button type="button" onClick={proceedAttestPick}>
                                                Weiter
                                            </Button>
                                        </>
                                    ) : null}
                                    {attestWizardStep === "compose" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={() => resetAttestWizard()} disabled={attestComposerBusy}>
                                                Abbrechen
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => void submitAttestComposer()}
                                                loading={attestComposerBusy}
                                                disabled={attestComposerBusy}
                                            >
                                                Attest für Patient speichern
                                            </Button>
                                        </>
                                    ) : null}
                                    {attestWizardStep === "ask_vorlage" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={onAttestAskVorlageNo}>
                                                Nein
                                            </Button>
                                            <Button type="button" onClick={onAttestAskVorlageYes}>
                                                Ja
                                            </Button>
                                        </>
                                    ) : null}
                                    {attestWizardStep === "name_vorlage" ? (
                                        <>
                                            <Button type="button" variant="ghost" onClick={onAttestNameVorlageSkip} disabled={attestComposerBusy}>
                                                Abbrechen
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => onAttestNameVorlageSave()}
                                                loading={attestComposerBusy}
                                                disabled={attestComposerBusy}
                                            >
                                                Vorlage anlegen und Attest speichern
                                            </Button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </FormSection>
                    </>
                    )}
                </Card>
                </div>
            )}
            {activeTab === "anlage" && (
                <div id="panel-anlage" role="tabpanel" aria-labelledby="tab-anlage">
                <Card className="card-pad">
                    <AkteAnlagenPanel
                        subtitle={
                            hasSectionData.anlage
                                ? "Je Datei einzeln durch den Arzt bestätigen — Aktionen über das Menü (···)."
                                : "Noch keine Anlagen — Datei hierher ziehen oder „Datei wählen“."
                        }
                        anlagen={anlagen}
                        fileInputId={anlageFileInputId}
                        cameraInputId={anlageCameraInputId}
                        canManageAnlagen={canWriteMedical}
                        onPickFile={(file) => {
                            const err = validateAnlageFile(file);
                            if (err) {
                                toast(err, "error");
                                return;
                            }
                            setAkteSaveConfirm({ kind: "anlage_add", file });
                        }}
                        onRename={(idx, name) => {
                            const row = anlagen[idx];
                            if (!row) return;
                            setAnlagen((prev) => prev.map((x, i) => (i === idx ? { ...x, name } : x)));
                            void (async () => {
                                try {
                                    await renameAkteAnlage(row.id, name);
                                } catch (e) {
                                    toast(`Umbenennen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
                                    if (akte) await refreshAnlagen(akte.id);
                                }
                            })();
                        }}
                        onRequestRemove={(idx, name) => {
                            const row = anlagen[idx];
                            if (!row) return;
                            setAkteSaveConfirm({ kind: "anlage_remove", id: row.id, name });
                        }}
                        onOpenExternal={(idx) => {
                            const row = anlagen[idx];
                            if (!row?.absPath) return;
                            void (async () => {
                                try {
                                    const withApp = await resolveOpenImageWithAppPath(
                                        loadClientSettings().akte?.openImagesWithApp,
                                    );
                                    await openAkteAnlageExternally(row.id, withApp);
                                } catch (e) {
                                    toast(`Öffnen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
                                }
                            })();
                        }}
                        onDuplicate={
                            canWriteMedical
                                ? (idx) => {
                                      const row = anlagen[idx];
                                      if (!row || !akte) return;
                                      void (async () => {
                                          try {
                                              await duplicateAkteAnlage(row.id);
                                              toast("Kopie der Anlage angelegt", "success");
                                              await refreshAnlagen(akte.id);
                                          } catch (e) {
                                              toast(
                                                  `Duplizieren fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
                                                  "error",
                                              );
                                          }
                                      })();
                                  }
                                : undefined
                        }
                        canValidate={canViewClinical}
                        isValidated={(anlageId) => Boolean(itemValidation[itemValidationKey("anl", anlageId)])}
                        onRequestValidate={(anlageId, label) => void requestValidateItem(itemValidationKey("anl", anlageId), label)}
                        onRevokeValidation={(anlageId, shortLabel) =>
                            void revokeItemValidationRow(itemValidationKey("anl", anlageId), shortLabel)}
                        formatAddedAt={formatDate}
                        onScannerClick={() =>
                            toast("Scanner-Anbindung ist in dieser Version noch nicht verfügbar.", "info")}
                    />
                </Card>
                </div>
            )}
            {activeTab === "zahl" && (
                <div id="panel-zahl" role="tabpanel" aria-labelledby="tab-zahl">
                <Card className="card-pad">
                    <CardHeader
                        title="Kundenleistungen & Abrechnung"
                        subtitle={
                            !hasSectionData.zahl
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
                                        onClick={() => setZahlListenModus("summe")}
                                    >
                                        Zahlungen
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={zahlListenModus === "historie"}
                                        className={`akte-zahl-modus__btn${zahlListenModus === "historie" ? " is-active" : ""}`}
                                        onClick={() => setZahlListenModus("historie")}
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
                                        onClick={() => {
                                            setZahlEdit(null);
                                            setZahlDeleteId(null);
                                            setZahlNewForm({
                                                linkKind: "",
                                                linkId: "",
                                                betrag: "",
                                                zahlungsart: "BAR",
                                                beschreibung: "",
                                            });
                                            setShowZahlComposer(true);
                                        }}
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
                                        setShowZahlComposer(false);
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
                                <Button type="button" variant="ghost" onClick={() => setShowZahlComposer(false)}>
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
                                                                onClick={() => {
                                                                    setZahlDeleteId(null);
                                                                    setZahlEditUnlocked(false);
                                                                    setZahlEditForm({
                                                                        betrag: String(z.betrag),
                                                                        zahlungsart: z.zahlungsart,
                                                                        beschreibung: z.beschreibung ?? "",
                                                                    });
                                                                    setZahlEdit(z);
                                                                }}
                                                            >
                                                                Bearbeiten
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger"
                                                                disabled={z.status !== "AUSSTEHEND" && z.status !== "TEILBEZAHLT"}
                                                                onClick={() => {
                                                                    setZahlEdit(null);
                                                                    setZahlDeleteId(z.id);
                                                                }}
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
                                                        onClose={() => setZahlEdit(null)}
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
                            onCancel={() => setZahlDeleteId(null)}
                            onConfirm={() => void handleDeleteZahlungRow()}
                            confirmLabel="Ja, löschen"
                            danger
                        />
                    ) : null}
                    {canFinanzenWrite && zahlEdit && zahlListenModus !== "historie" ? (
                        <AkteEditFormOrInline
                            area="patient_akte_zahlung_edit"
                            open={canFinanzenWrite && !!zahlEdit}
                            onClose={() => setZahlEdit(null)}
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
            )}
                </div>
            </div>
            <ConfirmDialog
                open={akteSaveConfirm !== null}
                onClose={cancelAkteSave}
                onConfirm={() => void flushAkteSave()}
                title={akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm).title : ""}
                message={akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm).message : ""}
                confirmLabel={akteSaveConfirm ? akteSaveConfirmUi(akteSaveConfirm).confirmLabel : "OK"}
                loading={akteSaveBusy}
            />
            {id ? (
                <ExportPickerDialog
                    open={akteExportPickerOpen}
                    onClose={() => setAkteExportPickerOpen(false)}
                    patientId={id}
                    patient={patient}
                    canViewClinical={canViewClinical}
                    canReadFinanzen={canReadFinanzen}
                    canAuditRead={canAuditRead}
                />
            ) : null}
            {htmlDocExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlDocExport(null)}
                    templateKind={htmlDocExport.kind}
                    exportPreviewTitle={htmlDocExport.exportPreviewTitle}
                    suggestedBasename={htmlDocExport.suggestedBasename}
                    bundle={htmlDocExport.bundle}
                    hint={htmlDocExport.hint}
                />
            ) : null}
        </div>
    );
}
