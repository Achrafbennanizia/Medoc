import { useCallback, useEffect, useId, useMemo, useRef, useState, Fragment } from "react";
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
    releaseBehandlungForBilling,
    releaseUntersuchungForBilling,
    updateUntersuchung,
    deleteUntersuchung,
    listAkteAnlagen,
    createAkteAnlage,
    deleteAkteAnlage,
    renameAkteAnlage,
    openAkteAnlageExternally,
    duplicateAkteAnlage,
} from "../../controllers/akte.controller";
import { listBehandlungsKatalog } from "../../controllers/praxis.controller";
import {
    flushAttestFinalizeVorlage,
    flushRezeptFinalizeVorlage,
} from "@/lib/patient-detail-rezept-actions";
import { formatCurrency, formatDate } from "../../lib/utils";
import { allowed, parseRole } from "../../lib/rbac";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Untersuchung, BehandlungsKatalogItem } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading } from "../components/ui/page-status";
import { DentalMiniBar } from "../components/DentalMiniBar";
import {
    EMPTY_ANAMNESE_V1_JSON,
    mergeQuickIntoAnamneseJson,
    parseAnamneseV1,
} from "@/lib/anamnese";
import { computeAkteCompleteness, type AkteCompletenessGap } from "@/lib/akte-completeness";
import { previewNextUntersuchungsnummer } from "@/lib/untersuchung";
import { CalendarIcon, ChevronLeftIcon, ExportIcon, MailIcon, PhoneIcon } from "@/lib/icons";
import type { BehandlungAkteComposerPanelProps } from "../components/behandlung-akte-composer-panel";
import { ConfirmDialog } from "../components/ui/dialog";
import { PatientAkteWorkflowDialogs, type PatientAkteWorkflowMode } from "../components/patient-akte-workflow-dialogs";
import { PatientDetailStammTab } from "./patient-detail-stamm-tab";
import { PatientDetailAnamTab } from "./patient-detail-anam-tab";
import { PatientDetailAnlageTab } from "./patient-detail-anlage-tab";
import { PatientDetailBehandTab } from "./patient-detail-behand-tab";
import { PatientDetailUnterTab } from "./patient-detail-unter-tab";
import { PatientDetailZahlTab } from "./patient-detail-zahl-tab";
import { PatientDetailRezeptTab, type PatientDetailRezeptTabHandle } from "./patient-detail-rezept-tab";
import { ExportPickerDialog, HtmlDocumentExportPickerDialog, type HtmlExportDocumentKind } from "../components/export-picker-dialog";
import { DischargeMerkblattDialog } from "../components/discharge-merkblatt-dialog";
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
import { listRezepte, type Rezept } from "@/controllers/rezept.controller";
import { listAtteste, type Attest } from "@/controllers/attest.controller";
import { listZahlungenForPatient, createZahlung, updateZahlung, deleteZahlung } from "@/controllers/zahlung.controller";
import type { Zahlung, ZahlungsArt } from "@/models/types";
import {
    emptyPlanNextTermin,
    mergeBehandlungFollowupIntoPlan,
    planNextHasContent,
    type PlanNextTerminV2,
} from "@/lib/plan-next-termin";
import { loadPlanNextTerminWithMigration, persistPlanNextTerminToBackend } from "@/controllers/plan-next-termin.controller";
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
    bundleQuittungExport,
    suggestQuittungExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import type { DocumentKind } from "@/lib/document-template-schema";
import { PraxisReadinessDialog } from "../components/praxis-readiness-dialog";
import { allocateQuittungNummer } from "@/controllers/invoice.controller";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";
import { openSystemScanUtility } from "@/controllers/system.controller";
import {
    ZAHL_EUR_EPS,
    aggregateZahlungenByZuordnung,
    buildOpenZahlLinkSelectOptions,
    maxEditZahlungBehandlung,
    maxNeuZahlungBehandlung,
    roundMoney2,
    sumZahlungenForBehandlung,
    latestZahlungForZuordnungRow,
    type ZahlZuordnungSummaryRow,
} from "@/lib/zahlung-buchung";
import {
    akteSaveConfirmUi,
    alterAusGeburtsdatum,
    behandlungContinueLabel,
    behandlungToUpdatePayload,
    isPatientenakteMissingError,
    PATIENT_DETAIL_TOAST_UNDO_MS,
    patientDetailTabFromHash,
    resolveKatalogIdForBehandlung,
    type AkteSavePending,
    type PatientDetailAkteTab,
} from "@/lib/patient-detail-utils";

type AkteTab = PatientDetailAkteTab;
const TOAST_UNDO_MS = PATIENT_DETAIL_TOAST_UNDO_MS;

export function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const detailQuery = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const fromTerminCreate = detailQuery.get("from") === "termin-create";
    const draft = detailQuery.get("draft") ?? "";
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canViewClinical = role != null && allowed("patient.read_medical", role);
    const canListPatientDocuments =
        role != null
        && (allowed("patient.read_medical", role) || allowed("patient.read_documents", role));
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
    const [dischargeMerkblattOpen, setDischargeMerkblattOpen] = useState(false);
    const [akteWorkflowMode, setAkteWorkflowMode] = useState<PatientAkteWorkflowMode>(null);
    const [praxisGuardKind, setPraxisGuardKind] = useState<DocumentKind | null>(null);

    const ensurePraxisForDocument = (kind: DocumentKind): boolean => {
        const readiness = checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), kind);
        if (!readiness.ready) {
            setPraxisGuardKind(kind);
            return false;
        }
        return true;
    };

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
    const rezeptTabRef = useRef<PatientDetailRezeptTabHandle>(null);
    const [activeTab, setActiveTab] = useState<AkteTab>("stamm");
    const [rezepte, setRezepte] = useState<Rezept[]>([]);
    /** Unteransicht auf dem Tab „Rezepte & Atteste“. */
    const [atteste, setAtteste] = useState<Attest[]>([]);
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
    /** Arzt → Rezeption: strukturierter Terminplan (SQLite `akte_next_termin_hint`). */
    const [showPlanTip, setShowPlanTip] = useState(false);
    const [planNext, setPlanNext] = useState<PlanNextTerminV2>(() => emptyPlanNextTermin());

    const terminBackLink = useMemo(() => {
        const pid = id ?? "";
        const q = new URLSearchParams();
        q.set("patient_id", pid);
        if (fromTerminCreate && draft) q.set("draft", draft);
        if (planNextHasContent(planNext)) q.set("apply_plan", "1");
        return `/termine/neu?${q.toString()}`;
    }, [id, fromTerminCreate, draft, planNext]);
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
            setPlanNext((prev) => {
                const merged =
                    canViewClinical ? next : { ...next, internalNote: prev.internalNote };
                if (id) {
                    void persistPlanNextTerminToBackend(id, merged).catch((e) => {
                        toast(`Termin-Hinweis speichern: ${e instanceof Error ? e.message : String(e)}`, "error");
                    });
                }
                return merged;
            });
        },
        [id, toast, canViewClinical],
    );

    useEffect(() => {
        const fromUrl = patientDetailTabFromHash(location.hash);
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
                canListPatientDocuments ? listRezepte(id) : Promise.resolve([] as Rezept[]),
                listZahlungenForPatient(id),
                canListPatientDocuments ? listAtteste(id) : Promise.resolve([] as Attest[]),
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
    }, [id, canViewClinical, canListPatientDocuments, canListBehandlungenForZahlung, refreshAnlagen]);

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
        if (id && payload.termin_erforderlich) {
            const merged = mergeBehandlungFollowupIntoPlan(planNext, {
                leistungsname: behandForm.leistungsname,
                notizen: behandForm.notizen ?? "",
            });
            if (planNextHasContent(merged)) {
                try {
                    await persistPlanNextTerminToBackend(id, merged);
                    setPlanNext(merged);
                } catch (err) {
                    toast(
                        `Folgetermin-Hinweis: ${err instanceof Error ? err.message : String(err)}`,
                        "error",
                    );
                }
            }
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
                case "attest_finalize_vorlage": {
                    if (await rezeptTabRef.current?.flushAkteSaveConfirm(p)) break;
                    if (!id || !session?.user_id) break;
                    const ctx = { patientId: id, userId: session.user_id, onReload: load, toast };
                    const noop = {
                        setComposerBusy: () => {},
                        clearPending: () => {},
                        refreshRezeptVorlagen: async () => {},
                        refreshAttestVorlagen: async () => {},
                    };
                    if (p.kind === "rezept_finalize_vorlage") {
                        await flushRezeptFinalizeVorlage(ctx, p, noop);
                    } else {
                        await flushAttestFinalizeVorlage(ctx, p, noop);
                    }
                    break;
                }
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

    const handlePrintQuittung = async (z: Zahlung) => {
        if (!ensurePraxisForDocument("quittung")) return;
        const ymd = zahlungLocalYmd(z.created_at);
        const nr = await allocateQuittungNummer(ymd);
        setHtmlDocExport({
            kind: "quittung",
            bundle: bundleQuittungExport(z, patient!, behandlungen, untersuchungen, nr),
            suggestedBasename: suggestQuittungExportBasename(z),
            exportPreviewTitle: `Quittung — ${patient!.name}`,
        });
    };

    const handlePrintQuittungFromSummeRow = (row: ZahlZuordnungSummaryRow) => {
        if (!id) return;
        const z = latestZahlungForZuordnungRow(row, zahlungen, id);
        if (!z) {
            toast("Keine druckbare Buchung für diese Zuordnung.", "info");
            return;
        }
        void handlePrintQuittung(z);
    };

    const akteCompleteness = useMemo(() => {
        if (!patient || !akte) return { gaps: [] as AkteCompletenessGap[] };
        return computeAkteCompleteness({
            patientVersicherungsnummer: patient.versicherungsnummer,
            anamneseJson,
            zahnbefundeCount: befunde.length,
            untersuchungenCount: untersuchungen.length,
            patientStatus: patient.status,
            includeClinicalGaps: canViewClinical,
        });
    }, [patient, akte, anamneseJson, befunde.length, untersuchungen.length, canViewClinical]);

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
                    {akteCompleteness.gaps.length > 0 ? (
                        <span
                            className="tab-badge muted"
                            style={{ marginLeft: 8, verticalAlign: "middle" }}
                            title={`${akteCompleteness.gaps.length} offene${akteCompleteness.gaps.length === 1 ? "r" : ""} Pflicht${akteCompleteness.gaps.length === 1 ? "punkt" : "punkte"} (Heuristik)`}
                        >
                            {akteCompleteness.gaps.length} offen
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
                    {role === "REZEPTION" && id && patient ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={() => setAkteWorkflowMode("ticket")}
                            title="Strukturiertes Ticket an einen Arzt (FA-PERS-08)"
                        >
                            Ticket an Arzt
                        </button>
                    ) : null}
                    {(role === "ARZT" || role === "REZEPTION") && id && patient ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={() => setAkteWorkflowMode("forward")}
                            title="Kolleg:innen per Benachrichtigung um Akten-Review bitten"
                        >
                            Review anfragen
                        </button>
                    ) : null}
                    {canViewClinical ? (
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={() => setDischargeMerkblattOpen(true)}
                            disabled={!id || !patient}
                            title="Entlassungs-Merkblatt / Nachsorge (PDF, FA-DOK-08)"
                        >
                            Merkblatt
                        </button>
                    ) : null}
                    <button type="button" className="btn btn-accent" onClick={() => navigate(terminBackLink)}><CalendarIcon />Termin</button>
                </div>
            </div>
            {akte && akteCompleteness.gaps.length > 0 ? (
                <div
                    className="card card-pad"
                    role="region"
                    aria-label="Aktenvollständigkeit"
                    style={{
                        padding: "12px 14px",
                        background: "color-mix(in oklab, var(--warning, #b45309) 8%, var(--surface-1))",
                        borderColor: "color-mix(in oklab, var(--warning, #b45309) 35%, var(--line))",
                    }}
                >
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Akte — fehlende Einträge (Hinweis)</div>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 10px", lineHeight: 1.45, maxWidth: 720 }}>
                        Heuristik gemäß FA-AKTE-16; kein Ersatz für klinische Beurteilung. Klick springt zum passenden Reiter.
                    </p>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {akteCompleteness.gaps.map((g) => (
                            <button
                                key={g.id}
                                type="button"
                                className="btn btn-subtle btn-sm"
                                onClick={() => goTab(g.tab as AkteTab)}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
            {showPlanTip ? (
                <div
                    className="card"
                    role="region"
                    aria-label="Terminplanung für Rezeption"
                    style={{ padding: 14, borderColor: "var(--accent)" }}
                >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Hinweis für die Rezeption</div>
                            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2, maxWidth: 640, lineHeight: 1.45 }}>
                                Kurz halten — erscheint kompakt im Dashboard unter „Ausstehende Freigaben“ mit Direktlink zu „Neuer Termin“.
                            </div>
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPlanTip(false)}>Schließen</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select
                            id="plan-urgency"
                            label="Dringlichkeit"
                            value={planNext.urgency}
                            onChange={(e) =>
                                persistPlanNext({ ...planNext, urgency: e.target.value as PlanNextTerminV2["urgency"] })}
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
                            onChange={(e) => persistPlanNext({ ...planNext, terminArtHint: e.target.value })}
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
                            onChange={(e) => persistPlanNext({ ...planNext, durationMin: e.target.value })}
                            placeholder="z. B. 30"
                        />
                    </div>
                    <Input
                        id="patient-plan-freetext"
                        label="Kurztext (max. eine Zeile)"
                        value={planNext.freeText}
                        onChange={(e) => persistPlanNext({ ...planNext, freeText: e.target.value.slice(0, 140) })}
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
                                onChange={(e) => persistPlanNext({ ...planNext, intervalWeeks: e.target.value })}
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
                                onChange={(e) => persistPlanNext({ ...planNext, preferredWeekdays: e.target.value })}
                                placeholder="z. B. Mo, Do"
                            />
                        </div>
                        {canViewClinical ? (
                            <Textarea
                                id="patient-plan-internal"
                                label="Intern (nicht im Dashboard sichtbar)"
                                rows={2}
                                value={planNext.internalNote}
                                onChange={(e) => persistPlanNext({ ...planNext, internalNote: e.target.value })}
                                placeholder="Nur Praxis-intern"
                                style={{ marginTop: 12 }}
                            />
                        ) : null}
                    </details>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                        {planNextHasContent(planNext) ? (
                            <Button size="sm" variant="ghost" onClick={() => persistPlanNext(emptyPlanNextTermin())}>
                                Hinweis leeren
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <div className="card patient-hero-card">
                <div className="patient-hero-top">
                    <div className="patient-hero-identity">
                        <div className="av av-lg av--accent">
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

            {activeTab === "stamm" && patient ? (
                <PatientDetailStammTab
                    patient={patient}
                    validationStamm={validation.stamm}
                    canViewClinical={canViewClinical}
                    patientDeleteOpen={patientDeleteOpen}
                    patientDeleteBusy={patientDeleteBusy}
                    showEditPatient={showEditPatient}
                    editForm={editForm}
                    onEditFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                    onOpenEdit={() => {
                        setPatientDeleteOpen(false);
                        setShowEditPatient(true);
                    }}
                    onOpenDelete={() => {
                        setShowEditPatient(false);
                        setPatientDeleteOpen(true);
                    }}
                    onCloseDelete={() => setPatientDeleteOpen(false)}
                    onConfirmDelete={handleDeletePatient}
                    onCloseEdit={() => setShowEditPatient(false)}
                    onSavePatient={runSavePatient}
                    onValidateStamm={() => validateSection("stamm")}
                    onRevokeStammValidation={() => revokeSectionValidation("stamm")}
                />
            ) : null}

            {activeTab === "anam" && canViewClinical ? (
                <PatientDetailAnamTab
                    validationStamm={validation.stamm}
                    anamEditing={anamEditing}
                    anamQuick={anamQuick}
                    anamneseSign={anamneseSign}
                    anamneseJson={anamneseJson}
                    onAnamEditingChange={setAnamEditing}
                    onAnamQuickChange={(patch) => setAnamQuick((q) => ({ ...q, ...patch }))}
                    onAnamneseSignChange={setAnamneseSign}
                    onCancelEdit={cancelAnamneseEdit}
                    onSave={runSaveAnamnese}
                />
            ) : null}

            {activeTab === "unter" && canViewClinical ? (
                <PatientDetailUnterTab
                    akte={akte}
                    befunde={befunde}
                    untersuchungen={untersuchungen}
                    showUnterComposer={showUnterComposer}
                    nextUnterPreview={nextUnterPreview}
                    unterDetailId={unterDetailId}
                    unterEdit={unterEdit}
                    unterEditUnlocked={unterEditUnlocked}
                    unterDeleteId={unterDeleteId}
                    canViewClinical={canViewClinical}
                    onStartNewUntersuchung={() => {
                        setUnterEdit(null);
                        setUnterDeleteId(null);
                        setShowUnterComposer(true);
                    }}
                    onToggleDetail={(id, open) => setUnterDetailId(open ? null : id)}
                    onReleaseForBilling={async (untersuchungId) => {
                        try {
                            const upd = await releaseUntersuchungForBilling(untersuchungId);
                            setUntersuchungen((prev) => prev.map((x) => (x.id === untersuchungId ? upd : x)));
                            toast("Untersuchung zur Abrechnung freigegeben.", "success");
                        } catch (e) {
                            toast(e instanceof Error ? e.message : String(e), "error");
                        }
                    }}
                    onStartEdit={(u) => {
                        setUnterDeleteId(null);
                        setShowUnterComposer(false);
                        setUnterEditUnlocked(false);
                        setUnterEdit({ ...u });
                    }}
                    onRequestDelete={(untersuchungId) => {
                        setUnterEdit(null);
                        setUnterDeleteId(untersuchungId);
                    }}
                    onUnlockEdit={() => setUnterEditUnlocked(true)}
                    onCloseEdit={() => setUnterEdit(null)}
                    onCancelDelete={() => setUnterDeleteId(null)}
                    onConfirmDelete={handleDeleteUntersuchungRow}
                    onCloseComposer={() => setShowUnterComposer(false)}
                    onApplyTooth={async (tooth: number, statusKey: string) => {
                        if (!akte) return;
                        await createZahnbefund({ akte_id: akte.id, zahn_nummer: tooth, befund: statusKey });
                        await load();
                    }}
                    onSaveEdit={runSaveUntersuchungEdit}
                    onCreateUntersuchung={handleCreateUntersuchung}
                />
            ) : null}

            {activeTab === "behand" && canViewClinical ? (
                <PatientDetailBehandTab
                    behandComposerCommon={behandComposerCommon}
                    behandlungen={behandlungen}
                    behandlungGroups={behandlungGroups}
                    showBehandComposer={showBehandComposer}
                    behandEditId={behandEditId}
                    behandDeleteId={behandDeleteId}
                    canViewClinical={canViewClinical}
                    onStartNewBehandlung={() => {
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
                    onContinueBehandlung={() => {
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
                    onReleaseForBilling={async (behandlungId: string) => {
                        try {
                            const upd = await releaseBehandlungForBilling(behandlungId);
                            setBehandlungen((prev) => prev.map((x) => (x.id === behandlungId ? upd : x)));
                            toast("Zur Abrechnung freigegeben.", "success");
                        } catch (e) {
                            toast(e instanceof Error ? e.message : String(e), "error");
                        }
                    }}
                    onOpenEditBehandlung={(b: Behandlung) => {
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
                    onRequestDeleteBehandlung={(behandlungId: string) => {
                        setShowBehandComposer(false);
                        setBehandComposerMode(null);
                        setBehandEditId(null);
                        setBehandFormUnlocked(true);
                        setContinueFromBehandlungId("");
                        setBehandDeleteId(behandlungId);
                    }}
                    onCancelDeleteBehandlung={() => setBehandDeleteId(null)}
                    onConfirmDeleteBehandlung={handleDeleteBehandlungRow}
                />
            ) : null}

            {activeTab === "rezept" && id && session?.user_id && (
                <PatientDetailRezeptTab
                    ref={rezeptTabRef}
                    patientId={id}
                    patient={patient}
                    rezepte={rezepte}
                    atteste={atteste}
                    canWriteMedical={canWriteMedical}
                    userId={session.user_id}
                    onReload={load}
                    onAkteSaveConfirm={setAkteSaveConfirm}
                    onHtmlDocExport={setHtmlDocExport}
                    ensurePraxisForDocument={ensurePraxisForDocument}
                />
            )}
            {activeTab === "anlage" ? (
                <PatientDetailAnlageTab
                    hasAnlagen={hasSectionData.anlage}
                    anlagen={anlagen}
                    fileInputId={anlageFileInputId}
                    cameraInputId={anlageCameraInputId}
                    canManageAnlagen={canWriteMedical}
                    canValidate={canViewClinical}
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
                    isValidated={(anlageId) => Boolean(itemValidation[itemValidationKey("anl", anlageId)])}
                    onRequestValidate={(anlageId, label) => void requestValidateItem(itemValidationKey("anl", anlageId), label)}
                    onRevokeValidation={(anlageId, shortLabel) =>
                        void revokeItemValidationRow(itemValidationKey("anl", anlageId), shortLabel)}
                    formatAddedAt={formatDate}
                    onScannerClick={() => {
                        void (async () => {
                            try {
                                await openSystemScanUtility();
                                toast(
                                    "System-Scanner geöffnet. Nach dem Speichern die Datei hier über „Datei wählen“ an die Akte anhängen.",
                                    "success",
                                );
                            } catch (e) {
                                toast(`Scanner: ${e instanceof Error ? e.message : String(e)}`, "error");
                            }
                        })();
                    }}
                />
            ) : null}
            {activeTab === "zahl" && (
                <PatientDetailZahlTab
                    patientId={id}
                    hasZahlData={hasSectionData.zahl}
                    zahlListenModus={zahlListenModus}
                    onZahlListenModusChange={setZahlListenModus}
                    canFinanzenWrite={canFinanzenWrite}
                    canViewClinical={canViewClinical}
                    showZahlComposer={showZahlComposer}
                    onOpenZahlComposer={() => {
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
                    onCloseZahlComposer={() => setShowZahlComposer(false)}
                    behandlungen={behandlungen}
                    untersuchungen={untersuchungen}
                    zahlungen={zahlungen}
                    zahlNewForm={zahlNewForm}
                    setZahlNewForm={setZahlNewForm}
                    zahlLinkSelectOptionsOpen={zahlLinkSelectOptionsOpen}
                    zahlNeuMaxBetragEur={zahlNeuMaxBetragEur}
                    zahlZuordnungSummaries={zahlZuordnungSummaries}
                    zahlungenHistorisch={zahlungenHistorisch}
                    zahlEdit={zahlEdit}
                    zahlEditUnlocked={zahlEditUnlocked}
                    zahlEditForm={zahlEditForm}
                    setZahlEditForm={setZahlEditForm}
                    zahlEditMaxBetragEur={zahlEditMaxBetragEur}
                    zahlDeleteId={zahlDeleteId}
                    itemValidation={itemValidation}
                    onPrintQuittung={handlePrintQuittung}
                    onPrintQuittungFromSummeRow={handlePrintQuittungFromSummeRow}
                    onSubmitSaveZahlNew={submitSaveZahlNew}
                    onSaveZahlEdit={runSaveZahlEdit}
                    onDeleteZahlung={handleDeleteZahlungRow}
                    onCancelDeleteZahlung={() => setZahlDeleteId(null)}
                    onCloseZahlEdit={() => setZahlEdit(null)}
                    onUnlockZahlEdit={() => setZahlEditUnlocked(true)}
                    onStartEditZahlung={(z) => {
                        setZahlDeleteId(null);
                        setZahlEditUnlocked(false);
                        setZahlEditForm({
                            betrag: String(z.betrag),
                            zahlungsart: z.zahlungsart,
                            beschreibung: z.beschreibung ?? "",
                        });
                        setZahlEdit(z);
                    }}
                    onRequestDeleteZahlung={(zahlungId) => {
                        setZahlEdit(null);
                        setZahlDeleteId(zahlungId);
                    }}
                    onRequestValidateItem={requestValidateItem}
                    onRevokeItemValidation={revokeItemValidationRow}
                    toast={toast}
                />
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
            {id ? (
                <DischargeMerkblattDialog
                    open={dischargeMerkblattOpen}
                    onClose={() => setDischargeMerkblattOpen(false)}
                    patientId={id}
                    patient={patient}
                />
            ) : null}
            <PraxisReadinessDialog
                open={praxisGuardKind != null}
                documentKind={praxisGuardKind ?? "akte"}
                result={checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), praxisGuardKind ?? "akte")}
                onClose={() => setPraxisGuardKind(null)}
            />
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
            {id && patient && session && role ? (
                <PatientAkteWorkflowDialogs
                    mode={akteWorkflowMode}
                    onClose={() => setAkteWorkflowMode(null)}
                    patientId={id}
                    currentUserId={session.user_id}
                    role={role}
                    toast={toast}
                />
            ) : null}
        </div>
    );
}
