import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { deletePatient, updatePatient } from "@/systems/practice-host/controllers/patient.controller";
import {
    createBehandlung,
    createUntersuchung,
    deleteBehandlung,
    deleteUntersuchung,
    saveAnamnesebogen,
    updateBehandlung,
    updateUntersuchung,
} from "@/systems/practice-host/controllers/akte.controller";
import { persistPlanNextTerminToBackend } from "@/systems/practice-host/controllers/plan-next-termin.controller";
import { mergeQuickIntoAnamneseJson, parseAnamneseV1 } from "@/lib/anamnese";
import { clearPatientScopedBrowserStorage } from "@/lib/patient-browser-storage";
import {
    behandlungContinueLabel,
    behandlungToUpdatePayload,
    PATIENT_DETAIL_TOAST_UNDO_MS,
    resolveKatalogIdForBehandlung,
} from "@/lib/patient-detail-utils";
import {
    buildBehandlungsKatalogCategoryOptions,
    DEFAULT_CATALOG_CATEGORIES,
} from "@/lib/behandlungs-katalog-categories";
import {
    mergeBehandlungFollowupIntoPlan,
    planNextHasContent,
    type PlanNextTerminV2,
} from "@/lib/plan-next-termin";
import { previewNextUntersuchungsnummer } from "@/lib/untersuchung";
import type {
    Behandlung,
    BehandlungsKatalogItem,
    Patient,
    Patientenakte,
    Untersuchung,
    Zahnbefund,
} from "@/models/types";
import type { BehandlungAkteComposerPanelProps } from "@/views/components/behandlung-akte-composer-panel";
import {
    behandlungHasBillableLeistung,
    openZahlTabAfterBillableBehandlung,
    openZahlTabAfterBillableUntersuchung,
    untersuchungHasBillableLeistung,
    type ZahlNewFormState,
} from "@/lib/billing-open-booking";
import type { PatientDetailAkteTab } from "@/lib/patient-detail-utils";
import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { useToastStore } from "@/views/components/ui/toast-store";

export type BehandFormState = {
    datum: string;
    kategorie: string;
    leistungsname: string;
    leistungKatalogId: string;
    behandlungsnummer: string;
    sitzung: string;
    gesamtkosten: string;
    behandlung_status: string;
    termin_erforderlich: string;
    notizen: string;
};

export type AnamQuickState = {
    versicherungsstatus: string;
    krankenkasse: string;
    chronisch: string;
    allergienMed: string;
};

const EMPTY_BEHAND_FORM = (): BehandFormState => ({
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

export type UsePatientDetailClinicalActionsArgs = {
    patientId: string | undefined;
    patient: Patient | null;
    akte: Patientenakte | null;
    canViewClinical: boolean;
    editForm: { name: string; telefon: string; email: string; adresse: string };
    setShowEditPatient: (v: boolean) => void;
    behandlungen: Behandlung[];
    untersuchungen: Untersuchung[];
    katalog: BehandlungsKatalogItem[];
    befunde: Zahnbefund[];
    behandForm: BehandFormState;
    setBehandForm: Dispatch<SetStateAction<BehandFormState>>;
    selectedBehandTooth: string | null;
    setSelectedBehandTooth: (v: string | null) => void;
    behandEditId: string | null;
    setBehandEditId: (v: string | null) => void;
    behandFormUnlocked: boolean;
    setBehandFormUnlocked: (v: boolean) => void;
    behandComposerMode: "new" | "continue" | null;
    setBehandComposerMode: (v: "new" | "continue" | null) => void;
    setShowBehandComposer: (v: boolean) => void;
    continueFromBehandlungId: string;
    setContinueFromBehandlungId: (v: string) => void;
    behandDeleteId: string | null;
    setBehandDeleteId: (v: string | null) => void;
    untersuchungForm: { beschwerden: string; ergebnisse: string; diagnose: string };
    setUntersuchungForm: Dispatch<SetStateAction<{ beschwerden: string; ergebnisse: string; diagnose: string }>>;
    setShowUnterComposer: (v: boolean) => void;
    unterEdit: Untersuchung | null;
    setUnterEdit: (v: Untersuchung | null) => void;
    unterDeleteId: string | null;
    setUnterDeleteId: (v: string | null) => void;
    anamneseJson: string;
    setAnamneseJson: (v: string) => void;
    anamQuick: AnamQuickState;
    setAnamQuick: Dispatch<SetStateAction<AnamQuickState>>;
    anamneseSign: boolean;
    setAnamEditing: (v: boolean) => void;
    planNext: PlanNextTerminV2;
    setPlanNext: Dispatch<SetStateAction<PlanNextTerminV2>>;
    setPatientDeleteOpen: (v: boolean) => void;
    setPatientDeleteBusy: (v: boolean) => void;
    load: () => Promise<void>;
    sessionRolle: string | undefined;
    goTab: (tab: PatientDetailAkteTab) => void;
    setShowZahlComposer: (v: boolean) => void;
    setZahlNewForm: (form: ZahlNewFormState) => void;
};

export function usePatientDetailClinicalActions(args: UsePatientDetailClinicalActionsArgs) {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const {
        patientId,
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
        sessionRolle,
        goTab,
        setShowZahlComposer,
        setZahlNewForm,
    } = args;

    const runSavePatient = async () => {
        if (!patientId || !patient || !editForm.name.trim()) return;
        const prev = {
            name: patient.name,
            telefon: patient.telefon ?? "",
            email: patient.email ?? "",
            adresse: patient.adresse ?? "",
        };
        try {
            await updatePatient(patientId, {
                name: editForm.name,
                telefon: editForm.telefon || null,
                email: editForm.email || null,
                adresse: editForm.adresse || null,
            });
            toast(t("patient.detail.toast.patient_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updatePatient(patientId, {
                            name: prev.name,
                            telefon: prev.telefon || null,
                            email: prev.email || null,
                            adresse: prev.adresse || null,
                        });
                        await load();
                    } catch (err) {
                        toast(tp("common.error_with_message", { message: err instanceof Error ? err.message : String(err) }), "error");
                    }
                },
            });
            setShowEditPatient(false);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
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
        const billable = behandlungHasBillableLeistung(
            payload.leistungsname,
            Number.isFinite(g) ? g : null,
        );
        let savedBehandlungId = behandEditId ?? "";
        try {
            if (behandEditId) {
                await updateBehandlung({ id: behandEditId, ...payload });
                toast(t("patient.detail.toast.behand_updated"), "success", {
                    durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                    onUndo: async () => {
                        if (!prevBh) return;
                        try {
                            await updateBehandlung(behandlungToUpdatePayload(prevBh));
                            await load();
                        } catch (err) {
                            toast(tp("common.error_with_message", { message: err instanceof Error ? err.message : String(err) }), "error");
                        }
                    },
                });
                setBehandEditId(null);
            } else {
                const created = await createBehandlung({ akte_id: akte.id, ...payload });
                savedBehandlungId = created.id;
                toast(t("patient.detail.toast.behand_documented"), "success", {
                    durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                    onUndo: async () => {
                        try {
                            await deleteBehandlung(created.id);
                            await load();
                        } catch (err) {
                            toast(tp("common.error_with_message", { message: err instanceof Error ? err.message : String(err) }), "error");
                        }
                    },
                });
            }
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
            return;
        }
        if (patientId && payload.termin_erforderlich) {
            const merged = mergeBehandlungFollowupIntoPlan(planNext, {
                leistungsname: behandForm.leistungsname,
                notizen: behandForm.notizen ?? "",
            });
            if (planNextHasContent(merged)) {
                try {
                    await persistPlanNextTerminToBackend(patientId, merged);
                    setPlanNext(merged);
                } catch (err) {
                    toast(
                        tp("patient.detail.toast.followup_hint_failed", {
                            message: err instanceof Error ? err.message : String(err),
                        }),
                        "error",
                    );
                }
            }
        }
        setBehandForm(EMPTY_BEHAND_FORM());
        setSelectedBehandTooth(null);
        setShowBehandComposer(false);
        setBehandComposerMode(null);
        setContinueFromBehandlungId("");
        setBehandFormUnlocked(true);
        await load();
        if (sessionRolle === "ARZT" && billable && savedBehandlungId) {
            openZahlTabAfterBillableBehandlung({
                behandlungId: savedBehandlungId,
                gesamtkosten: Number.isFinite(g) ? g : null,
                goTab,
                setShowZahlComposer,
                setZahlNewForm,
            });
            toast(t("patient.detail.toast.billing_area_opened"), "info");
        }
    };

    const runSaveBehandlung = () => {
        if (!akte) return;
        if (behandEditId && !behandFormUnlocked) {
            toast(t("patient.detail.toast.edit_unlock_first"), "info");
            return;
        }
        if (!behandForm.kategorie.trim() || !behandForm.leistungsname.trim()) {
            toast(t("patient.detail.toast.category_leistung_required"), "error");
            return;
        }
        void persistBehandlungAfterConfirm();
    };

    const persistUntersuchungCreate = async (data: {
        beschwerden: string;
        diagnose: string;
        ergebnisseJson: string;
        kategorie?: string | null;
        leistungsname?: string | null;
        gesamtkosten?: number | null;
    }) => {
        if (!akte) return;
        const billable = untersuchungHasBillableLeistung(data.leistungsname, data.gesamtkosten ?? null);
        try {
            const created = await createUntersuchung({
                akte_id: akte.id,
                beschwerden: data.beschwerden.trim() || null,
                ergebnisse: data.ergebnisseJson.trim() || null,
                diagnose: data.diagnose.trim() || null,
                kategorie: data.kategorie?.trim() || null,
                leistungsname: data.leistungsname?.trim() || null,
                gesamtkosten: data.gesamtkosten ?? null,
            });
            toast(t("patient.detail.toast.untersuchung_captured"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteUntersuchung(created.id);
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setShowUnterComposer(false);
            setUntersuchungForm({ beschwerden: "", ergebnisse: "", diagnose: "" });
            await load();
            if (sessionRolle === "ARZT" && billable) {
                openZahlTabAfterBillableUntersuchung({
                    untersuchungId: created.id,
                    gesamtkosten: data.gesamtkosten ?? null,
                    goTab,
                    setShowZahlComposer,
                    setZahlNewForm,
                });
                toast(t("patient.detail.toast.billing_area_opened"), "info");
            }
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleCreateUntersuchung = async (payload?: {
        beschwerden: string;
        diagnose: string;
        ergebnisseJson: string;
        kategorie?: string | null;
        leistungsname?: string | null;
        gesamtkosten?: number | null;
    }) => {
        const data =
            payload ??
            ({
                beschwerden: untersuchungForm.beschwerden,
                diagnose: untersuchungForm.diagnose,
                ergebnisseJson: untersuchungForm.ergebnisse,
            } as const);
        await persistUntersuchungCreate(data);
    };

    const runSaveUntersuchungEdit = async (payload: {
        beschwerden: string;
        diagnose: string;
        ergebnisseJson: string;
    }) => {
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
                kategorie: unterEdit.kategorie ?? null,
                leistungsname: unterEdit.leistungsname ?? null,
                gesamtkosten: unterEdit.gesamtkosten ?? null,
            });
            toast(t("patient.detail.toast.untersuchung_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateUntersuchung({
                            id: uid,
                            beschwerden: prevSnap.beschwerden ?? null,
                            ergebnisse: prevSnap.ergebnisse ?? null,
                            diagnose: prevSnap.diagnose ?? null,
                            kategorie: unterEdit.kategorie ?? null,
                            leistungsname: unterEdit.leistungsname ?? null,
                            gesamtkosten: unterEdit.gesamtkosten ?? null,
                        });
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setUnterEdit(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
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
    }, [anamneseJson, setAnamQuick, setAnamEditing]);

    const runSaveAnamnese = async () => {
        if (!patientId) return;
        const merged = mergeQuickIntoAnamneseJson(anamneseJson, anamQuick);
        let antworten: unknown;
        try {
            antworten = JSON.parse(merged || "{}");
        } catch {
            toast(t("patient.detail.toast.anamnese_invalid"));
            return;
        }
        const rollbackJson = anamneseJson;
        const rollbackQuick = { ...anamQuick };
        const rollbackSign = anamneseSign;
        let rollbackParsed: unknown;
        try {
            rollbackParsed = JSON.parse(mergeQuickIntoAnamneseJson(rollbackJson, rollbackQuick) || "{}");
        } catch {
            toast(t("patient.detail.toast.anamnese_invalid"));
            return;
        }
        try {
            await saveAnamnesebogen({
                patient_id: patientId,
                antworten,
                unterschrieben: anamneseSign,
            });
            toast(t("patient.detail.toast.anamnese_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await saveAnamnesebogen({
                            patient_id: patientId,
                            antworten: rollbackParsed,
                            unterschrieben: rollbackSign,
                        });
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setAnamneseJson(JSON.stringify(antworten, null, 2));
            setAnamEditing(false);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeleteBehandlungRow = async () => {
        if (!behandDeleteId) return;
        try {
            await deleteBehandlung(behandDeleteId);
            toast(t("patient.detail.toast.behand_deleted"));
            setBehandDeleteId(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeleteUntersuchungRow = async () => {
        if (!unterDeleteId) return;
        try {
            await deleteUntersuchung(unterDeleteId);
            toast(t("patient.detail.toast.untersuchung_deleted"));
            setUnterDeleteId(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeletePatient = async () => {
        if (!patientId || !canViewClinical) return;
        setPatientDeleteBusy(true);
        try {
            await deletePatient(patientId);
            clearPatientScopedBrowserStorage(patientId);
            toast(t("patient.detail.toast.akte_deleted"));
            setPatientDeleteOpen(false);
            navigate("/patienten");
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setPatientDeleteBusy(false);
        }
    };

    const kategorieOptions = useMemo(() => {
        const values = new Set<string>([...DEFAULT_CATALOG_CATEGORIES, ...katalog.map((k) => k.kategorie)]);
        if (behandForm.kategorie) values.add(behandForm.kategorie);
        const rest = buildBehandlungsKatalogCategoryOptions(t, values, sortLocale);
        return [{ value: "", label: t("patient.detail.behand.category_pick") }, ...rest];
    }, [katalog, behandForm.kategorie, sortLocale, t]);

    const leistungOptions = useMemo(() => {
        if (!behandForm.kategorie) {
            return [{ value: "", label: t("patient.detail.behand.category_first") }];
        }
        const filtered = katalog.filter((k) => k.kategorie === behandForm.kategorie);
        return [{ value: "", label: t("patient.detail.behand.leistung_pick") }, ...filtered.map((k) => ({ value: k.id, label: k.name }))];
    }, [katalog, behandForm.kategorie, t]);

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
        return `${prefix}${String(max + 1).padStart(3, "0")}`;
    }, [behandlungen]);

    const applyContinueFromBehandlung = useCallback(
        (behandlungId: string) => {
            const b = behandlungen.find((x) => x.id === behandlungId);
            if (!b) return;
            const bn = (b.behandlungsnummer ?? "").trim();
            if (!bn) {
                toast(t("patient.detail.toast.no_b_number"), "info");
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
        [behandlungen, katalog, toast, t, setContinueFromBehandlungId, setBehandForm, setSelectedBehandTooth],
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

    return {
        runSavePatient,
        runSaveBehandlung,
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
    };
}
