import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import {
    getAkte,
    listZahnbefunde,
    createZahnbefund,
    getAnamnesebogen,
    listBehandlungen,
    listUntersuchungen,
    releaseBehandlungForBilling,
    releaseUntersuchungForBilling,
    listAkteAnlagen,
    renameAkteAnlage,
    openAkteAnlageExternally,
    duplicateAkteAnlage,
} from "@/systems/practice-host/controllers/akte.controller";
import { listBehandlungsKatalog } from "@/systems/practice-host/controllers/praxis.controller";
import { errorMessage, formatDate } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Untersuchung, BehandlungsKatalogItem } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";
import { PageLoading } from "@/views/components/ui/page-status";
import { EMPTY_ANAMNESE_V1_JSON, parseAnamneseV1 } from "@/lib/anamnese";
import { computeAkteCompleteness, type AkteCompletenessGap } from "@/lib/akte-completeness";
import { PatientDetailAkteSubnav } from "./patient-detail-akte-subnav";
import { PatientDetailShellHeader } from "./patient-detail-shell-header";
import { WorkspacePageHeader } from "@/views/components/verwaltung-page-header";
import { usePatientDetailAkteSave } from "./use-patient-detail-akte-save";
import { usePatientDetailClinicalActions } from "./use-patient-detail-clinical-actions";
import { usePatientDetailValidation } from "./use-patient-detail-validation";
import { usePatientDetailZahlActions } from "./use-patient-detail-zahl-actions";
import { PatientDetailOverlays } from "./patient-detail-overlays";
import type { PatientAkteWorkflowMode } from "@/views/components/patient-akte-workflow-dialogs";
import { PatientDetailAnamTab } from "./patient-detail-anam-tab";
import { PatientDetailAnlageTab } from "./patient-detail-anlage-tab";
import { PatientDetailBehandTab } from "./patient-detail-behand-tab";
import { PatientDetailUnterTab } from "./patient-detail-unter-tab";
import { PatientDetailZahlTab } from "./patient-detail-zahl-tab";
import { PatientDetailRezeptTab, type PatientDetailRezeptTabHandle } from "./patient-detail-rezept-tab";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { itemValidationKey, type ValidationRecord, type ValidationState } from "@/lib/akte-validation";
import { listRezepte, type Rezept } from "@/systems/practice-host/controllers/rezept.controller";
import { listAtteste, type Attest } from "@/systems/practice-host/controllers/attest.controller";
import { listZahlungenForPatient } from "@/systems/practice-host/controllers/zahlung.controller";
import type { Zahlung, ZahlungsArt } from "@/models/types";
import {
    emptyPlanNextTermin,
    planNextHasContent,
    type PlanNextTerminV2,
} from "@/lib/plan-next-termin";
import { loadPlanNextTerminWithMigration, persistPlanNextTerminToBackend } from "@/systems/practice-host/controllers/plan-next-termin.controller";
import {
    validateAnlageFile,
    mapAkteAnlageRowDto,
    type AkteAnlage,
} from "@/lib/akte-anlagen";
import { loadClientSettings } from "@/lib/client-settings";
import { resolveOpenImageWithAppPath } from "@/lib/photo-viewer-apps";
import { type ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import type { DocumentKind } from "@/lib/document-template-schema";
import { openSystemScanUtility } from "@/systems/practice-host/controllers/system.controller";
import { buildOpenZahlLinkSelectOptions } from "@/lib/zahlung-buchung";
import {
    isPatientenakteMissingError,
    patientDetailDefaultTab,
    patientDetailTabBlocked,
    resolvePatientDetailTabFromHash,
    resolveKatalogIdForBehandlung,
    type AkteSavePending,
    type PatientDetailAkteTab,
} from "@/lib/patient-detail-utils";

type AkteTab = PatientDetailAkteTab;

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
    const canReadDocuments = role != null && allowed("patient.read_documents", role);
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
    const [showClinicalPrices, setShowClinicalPrices] = useState(false);
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
    /** Anamnese: read-only first, fields unlock after edit action. */
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
    const [activeTab, setActiveTab] = useState<AkteTab>(() => patientDetailDefaultTab(canViewClinical));
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
    /** When save runs via popup (e.g. Untersuchung), unblock composer here. */
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
    /** When editing a row: view first (locked), then edit. New/continue: unlocked immediately. */
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
    const t = useT();
    const tp = useTParams();
    const canFinanzenWrite = (() => {
        const r = parseRole(session?.rolle);
        return r ? allowed("finanzen.write", r) : false;
    })();

    const {
        validateSection,
        revokeSectionValidation,
        requestValidateItem,
        revokeItemValidationRow,
    } = usePatientDetailValidation({
        patientId: id,
        sessionUserId: session?.user_id,
        validation,
        setValidation,
        setItemValidation,
    });

    useEffect(() => {
        if (!id) return;
        void loadPlanNextTerminWithMigration(id)
            .then(setPlanNext)
            .catch((e: unknown) => {
                setPlanNext(emptyPlanNextTermin());
                toast(
                    tp("patient.detail.toast.plan_load_failed", {
                        message: e instanceof Error ? e.message : String(e),
                    }),
                    "error",
                );
            });
    }, [id, toast, tp]);

    useEffect(() => {
        anlagenRef.current = anlagen;
    }, [anlagen]);

    const persistPlanNext = useCallback(
        (next: PlanNextTerminV2) => {
            setPlanNext((prev) => {
                const merged =
                    canViewClinical ? next : { ...next, internalNote: prev.internalNote };
                if (id) {
                    void persistPlanNextTerminToBackend(id, merged).catch((e) => {
                        toast(tp("patient.detail.toast.plan_save_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
                    });
                }
                return merged;
            });
        },
        [id, toast, tp, canViewClinical],
    );

    useEffect(() => {
        const rawHash = location.hash.replace(/^#/, "");
        if (rawHash === "stamm") {
            const tab = patientDetailDefaultTab(canViewClinical);
            setActiveTab(tab);
            navigate({ pathname: location.pathname, search: location.search, hash: tab }, { replace: true });
            return;
        }
        const fromUrl = resolvePatientDetailTabFromHash(location.hash, canViewClinical);
        if (!fromUrl) return;
        if (patientDetailTabBlocked(fromUrl, canViewClinical)) {
            const fallback = patientDetailDefaultTab(canViewClinical);
            setActiveTab(fallback);
            navigate({ pathname: location.pathname, search: location.search, hash: fallback }, { replace: true });
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
                listBehandlungsKatalog().catch((e) => {
                    toast(tp("patient.detail.toast.katalog_load_failed", { message: errorMessage(e) }), "warning");
                    return [] as BehandlungsKatalogItem[];
                }),
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
    }, [id, canViewClinical, canListPatientDocuments, canListBehandlungenForZahlung, refreshAnlagen, toast]);

    useEffect(() => { load(); }, [load]);

    const {
        runSavePatient,
        handleCreateUntersuchung,
        runSaveUntersuchungEdit,
        cancelAnamneseEdit,
        runSaveAnamnese,
        handleDeleteBehandlungRow,
        handleDeleteUntersuchungRow,
        handleDeletePatient,
        behandlungGroups,
        generateNewBehandlungsnummer,
        nextUnterPreview,
        behandComposerCommon,
    } = usePatientDetailClinicalActions({
        patientId: id,
        patient,
        akte,
        canViewClinical,
        editForm,
        setShowEditPatient,
        behandlungen,
        untersuchungen,
        katalog,
        befunde,
        behandForm,
        setBehandForm,
        selectedBehandTooth,
        setSelectedBehandTooth,
        behandEditId,
        setBehandEditId,
        behandFormUnlocked,
        setBehandFormUnlocked,
        behandComposerMode,
        setBehandComposerMode,
        setShowBehandComposer,
        continueFromBehandlungId,
        setContinueFromBehandlungId,
        behandDeleteId,
        setBehandDeleteId,
        untersuchungForm,
        setUntersuchungForm,
        setShowUnterComposer,
        unterEdit,
        setUnterEdit,
        unterDeleteId,
        setUnterDeleteId,
        anamneseJson,
        setAnamneseJson,
        anamQuick,
        setAnamQuick,
        anamneseSign,
        setAnamEditing,
        planNext,
        setPlanNext,
        setPatientDeleteOpen,
        setPatientDeleteBusy,
        load,
        sessionRolle: session?.rolle,
        goTab,
        setShowZahlComposer,
        setZahlNewForm,
    });

    const {
        zahlLinkSelectOptionsOpen,
        zahlZuordnungSummaries,
        zahlungenHistorisch,
        zahlNeuMaxBetragEur,
        zahlEditMaxBetragEur,
        runSaveZahlEdit,
        submitSaveZahlNew,
        handleDeleteZahlungRow,
        handlePrintQuittung,
        handlePrintQuittungFromSummeRow,
    } = usePatientDetailZahlActions({
        patientId: id,
        patient,
        behandlungen,
        untersuchungen,
        zahlungen,
        zahlNewForm,
        setZahlNewForm,
        setShowZahlComposer,
        zahlEdit,
        setZahlEdit,
        zahlEditUnlocked,
        zahlEditForm,
        zahlDeleteId,
        setZahlDeleteId,
        load,
        ensurePraxisForDocument,
        setHtmlDocExport,
    });

    const { flushAkteSave, cancelAkteSave } = usePatientDetailAkteSave({
        akteSaveConfirm,
        setAkteSaveConfirm,
        akteSaveBusy,
        setAkteSaveBusy,
        akte,
        patientId: id,
        sessionUserId: session?.user_id,
        rezeptTabRef,
        load,
        refreshAnlagen,
    });

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
        const openOpts = buildOpenZahlLinkSelectOptions(zahlungen, id, behandlungen, untersuchungen, t, tp);
        if (!openOpts.some((o) => o.value === v)) {
            setZahlNewForm((p) => ({ ...p, linkKind: "", linkId: "" }));
        }
    }, [id, zahlungen, behandlungen, untersuchungen, zahlNewForm.linkKind, zahlNewForm.linkId, t, tp]);

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
                <WorkspacePageHeader
                    title={t("patient.detail.title")}
                    back={{ to: "/patienten", label: t("patient.detail.back") }}
                />
                <p className="text-body text-on-surface-variant mt-4">{t("patient.detail.no_selection")}</p>
            </div>
        );
    }

    if (patientLoadError) {
        return (
            <div className="praxis-workspace-page animate-fade-in">
                <WorkspacePageHeader
                    title={t("patient.detail.title")}
                    back={{ to: "/patienten", label: t("patient.detail.back") }}
                />
                <div className="rounded-lg bg-error-container text-error px-4 py-3 text-body max-w-xl">
                    {patientLoadError}
                </div>
                <Button onClick={() => load()}>{t("common.retry")}</Button>
            </div>
        );
    }

    if (!patient) return <PageLoading label={t("patient.detail.loading")} />;

    /** Welche Sektionen enthalten Daten? */
    const hasSectionData = {
        anam: anamneseJson.trim().length > 0,
        anlage: anlagen.length > 0,
        zahl: zahlungen.length > 0,
    } as const;
    const anlPending = anlagen.filter((a) => !itemValidation[itemValidationKey("anl", a.id)]).length;
    const zahlPending = zahlungen.filter((z) => !itemValidation[itemValidationKey("zahl", z.id)]).length;
    const validationPendingTotal = canViewClinical
        ? ((!validation.stamm ? 1 : 0) + anlPending + zahlPending)
        : 0;


    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <PatientDetailShellHeader
                patient={patient}
                validationPendingTotal={validationPendingTotal}
                completenessGaps={akteCompleteness.gaps}
                validationStamm={validation.stamm}
                canWriteMedical={canWriteMedical}
                showPlanTip={showPlanTip}
                planNext={planNext}
                canViewClinical={canViewClinical}
                role={role}
                patientId={id}
                akte={akte}
                befunde={befunde}
                behandlungen={behandlungen}
                zahlungen={zahlungen}
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
                onNavigateBack={() => navigate("/patienten")}
                onTogglePlanTip={() => setShowPlanTip((v) => !v)}
                onPersistPlanNext={persistPlanNext}
                onOpenExport={() => setAkteExportPickerOpen(true)}
                onOpenTicket={() => setAkteWorkflowMode("ticket")}
                onOpenAufgabe={() => setAkteWorkflowMode("aufgabe")}
                onOpenForward={() => setAkteWorkflowMode("forward")}
                onOpenDischargeMerkblatt={() => setDischargeMerkblattOpen(true)}
                onOpenTermin={() => navigate(terminBackLink)}
                onGoTab={goTab}
            />

            <div className="akte-workspace" style={{ display: "grid", gridTemplateColumns: "minmax(200px, 220px) 1fr", gap: 20 }}>
                <PatientDetailAkteSubnav
                    activeTab={activeTab}
                    canViewClinical={canViewClinical}
                    validation={validation}
                    anlagen={anlagen}
                    zahlungen={zahlungen}
                    itemValidation={itemValidation}
                    onSelectTab={goTab}
                />
                <div className="col" style={{ gap: 16, minWidth: 0 }}>
                    {akteLoadError ? (
                        <DismissibleNotice variant="error" role="alert" title={t("patient.detail.akte_load_error")}>
                            {akteLoadError}
                        </DismissibleNotice>
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
                    showClinicalPrices={showClinicalPrices}
                    onToggleClinicalPrices={() => setShowClinicalPrices((v) => !v)}
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
                        toast(tp("patient.detail.toast.behand_new_started", { number: nextNr }), "success");
                    }}
                    onContinueBehandlung={() => {
                        const firstId = behandlungen[0]?.id;
                        if (!firstId) {
                            toast(t("patient.detail.toast.no_behandlung_continue"), "info");
                            return;
                        }
                        setBehandDeleteId(null);
                        setBehandEditId(null);
                        setBehandFormUnlocked(true);
                        setBehandComposerMode("continue");
                        setShowBehandComposer(true);
                        behandComposerCommon.applyContinueFromBehandlung(firstId);
                        toast(t("patient.detail.toast.behandlung_continue"), "success");
                    }}
                    onReleaseForBilling={async (behandlungId: string) => {
                        try {
                            const upd = await releaseBehandlungForBilling(behandlungId);
                            setBehandlungen((prev) => prev.map((x) => (x.id === behandlungId ? upd : x)));
                            toast(t("patient.detail.toast.released_billing"), "success");
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
                        const err = validateAnlageFile(t, file);
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
                                toast(tp("patient.detail.toast.anlage_rename_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
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
                                toast(tp("patient.detail.toast.anlage_open_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
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
                                          toast(t("patient.detail.toast.anlage_copy"), "success");
                                          await refreshAnlagen(akte.id);
                                      } catch (e) {
                                          toast(
                                              tp("patient.detail.toast.anlage_duplicate_failed", {
                                                  message: e instanceof Error ? e.message : String(e),
                                              }),
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
                                    t("patient.detail.toast.scanner_open"),
                                    "success",
                                );
                            } catch (e) {
                                toast(tp("patient.detail.toast.scanner_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
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
            {patient && session && role ? (
                <PatientDetailOverlays
                    patientId={id}
                    patient={patient}
                    sessionUserId={session.user_id}
                    role={role}
                    canViewClinical={canViewClinical}
                    canReadDocuments={canReadDocuments}
                    canReadFinanzen={canReadFinanzen}
                    canAuditRead={canAuditRead}
                    akteSaveConfirm={akteSaveConfirm}
                    akteSaveBusy={akteSaveBusy}
                    onCloseAkteSave={cancelAkteSave}
                    onConfirmAkteSave={() => void flushAkteSave()}
                    akteExportPickerOpen={akteExportPickerOpen}
                    onCloseAkteExport={() => setAkteExportPickerOpen(false)}
                    dischargeMerkblattOpen={dischargeMerkblattOpen}
                    onCloseDischargeMerkblatt={() => setDischargeMerkblattOpen(false)}
                    praxisGuardKind={praxisGuardKind}
                    onClosePraxisGuard={() => setPraxisGuardKind(null)}
                    htmlDocExport={htmlDocExport}
                    onCloseHtmlDocExport={() => setHtmlDocExport(null)}
                    akteWorkflowMode={akteWorkflowMode}
                    onCloseAkteWorkflow={() => setAkteWorkflowMode(null)}
                    toast={toast}
                />
            ) : null}
        </div>
    );
}
