import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Personal } from "@/models/types";
import type {
    PraxisAufgabe,
    PraxisAufgabeStatus,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import {
    transitionPraxisAufgabe,
    updatePraxisAufgabeAdmin,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { errorMessage } from "@/lib/utils";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import {
    BoltIcon,
    CheckIcon,
    EditIcon,
    EyeIcon,
    ShieldCheckIcon,
    XIcon,
} from "@/lib/icons";
import { Input, Textarea } from "../ui/input";
import { useToastStore } from "../ui/toast-store";
import {
    assigneeLabel,
    canFulfillAsArzt,
    canFulfillAsRezeption,
    canValidateAsArzt,
    canValidateAsRezeption,
    dispatchNavBadgeRefresh,
    userCanViewAufgabe,
} from "./aufgabe-workflow";
import { countOpenPraxisAufgabenForMe } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import {
    AUFGABE_WORKFLOW_STEPS,
    aufgabeDrawerText,
    aufgabeStatusLabel,
    aufgabeStatusPillClass,
    aufgabeTypLabel,
    aufgabeWorkflowActiveStep,
} from "./aufgabe-workflow-ui";
import { PraxisAufgabeKommentare } from "./praxis-aufgabe-kommentare";

const WORKFLOW_ICONS = [CheckIcon, BoltIcon, EyeIcon, ShieldCheckIcon] as const;

export type PraxisAufgabeDetailDrawerProps = {
    aufgabe: PraxisAufgabe;
    patientName: string;
    creatorLabel: string;
    personal: Personal[];
    userId: string;
    isArzt: boolean;
    isRezeption: boolean;
    canAdmin?: boolean;
    canAdminStatus?: boolean;
    canFulfillStatus?: boolean;
    busy?: boolean;
    onClose: () => void;
    onUpdated: (aufgabe: PraxisAufgabe) => void;
    onEdit?: () => void;
};

export function PraxisAufgabeDetailDrawer({
    aufgabe,
    patientName,
    creatorLabel,
    personal,
    userId,
    isArzt,
    isRezeption,
    canAdmin = false,
    canAdminStatus = false,
    canFulfillStatus = false,
    busy: busyExternal = false,
    onClose,
    onUpdated,
    onEdit,
}: PraxisAufgabeDetailDrawerProps) {
    const t = useT();
    const dateFnsLocale = useDateFnsLocale();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [busyLocal, setBusyLocal] = useState(false);
    const [completeNote, setCompleteNote] = useState("");
    const [returnReason, setReturnReason] = useState("");
    const [showReturnForm, setShowReturnForm] = useState(false);
    const busy = busyExternal || busyLocal;
    const tx = (key: string) => aufgabeDrawerText(t, key);

    const showRezFulfill = isRezeption && canFulfillAsRezeption(aufgabe, userId);
    const showArztFulfill = isArzt && canFulfillAsArzt(aufgabe, userId);
    const showArztValidate = isArzt && canValidateAsArzt(aufgabe, userId);
    const showRezValidate = isRezeption && canValidateAsRezeption(aufgabe, userId);
    const canFulfillWorkflow =
        canAdminStatus || canFulfillStatus || showRezFulfill || showArztFulfill;
    const canTake =
        canFulfillWorkflow &&
        (aufgabe.status === "OFFEN" || (canAdminStatus && aufgabe.status === "ZURUECK"));
    const canComplete =
        canFulfillWorkflow &&
        (aufgabe.status === "IN_BEARBEITUNG" ||
            aufgabe.status === "ZURUECK" ||
            (canAdminStatus && aufgabe.status === "OFFEN"));
    const canValidate = showArztValidate || showRezValidate;
    const active = aufgabeWorkflowActiveStep(aufgabe.status);
    const canComment = canAdmin || userCanViewAufgabe(aufgabe, userId, { isRezeption });

    const canClickWorkflowStep = (stepIndex: number): boolean => {
        const target = AUFGABE_WORKFLOW_STEPS[stepIndex]?.status;
        if (!target || target === aufgabe.status) return false;
        if (canAdminStatus) return true;
        if (target === "IN_BEARBEITUNG" && canTake) return true;
        if (target === "ERLEDIGT_REZEPTION" && canComplete) return true;
        if (target === "VALIDIERT" && canValidate) return true;
        if (target === "OFFEN" && aufgabe.status === "IN_BEARBEITUNG") {
            return canAdminStatus || showRezFulfill || showArztFulfill;
        }
        return false;
    };

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            panelRef.current?.querySelector<HTMLButtonElement>(".termin-drawer-head .icon-btn")?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const applyStatus = async (
        status: PraxisAufgabeStatus,
        extra?: { erledigtNotiz?: string; zurueckBegruendung?: string },
    ) => {
        if (busy) return;
        setBusyLocal(true);
        try {
            const updated = canAdminStatus
                ? await updatePraxisAufgabeAdmin({ id: aufgabe.id, status })
                : await transitionPraxisAufgabe({ id: aufgabe.id, status, ...extra });
            toast(t("page.praxis_tickets.aufgabe_updated_toast"), "success");
            onUpdated(updated);
            if (status === "ZURUECK") {
                setShowReturnForm(false);
                setReturnReason("");
                void countOpenPraxisAufgabenForMe().then((n) => dispatchNavBadgeRefresh(n));
                window.dispatchEvent(new CustomEvent("medoc-in-app-notifications-refresh"));
            } else {
                setShowReturnForm(false);
                setReturnReason("");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyLocal(false);
        }
    };

    const onWorkflowStep = (stepIndex: number) => {
        if (!canClickWorkflowStep(stepIndex)) return;
        const target = AUFGABE_WORKFLOW_STEPS[stepIndex]?.status;
        if (!target || target === aufgabe.status) return;
        if (canAdminStatus) {
            void applyStatus(target);
            return;
        }
        if (target === "IN_BEARBEITUNG" && canTake) {
            void applyStatus("IN_BEARBEITUNG");
            return;
        }
        if (target === "ERLEDIGT_REZEPTION" && canComplete) {
            const note = completeNote.trim() || (aufgabe.body ?? aufgabe.titel).trim();
            void applyStatus("ERLEDIGT_REZEPTION", { erledigtNotiz: note || undefined });
            return;
        }
        if (target === "VALIDIERT" && canValidate) {
            void applyStatus("VALIDIERT");
            return;
        }
        if (target === "OFFEN" && aufgabe.status === "IN_BEARBEITUNG" && (showRezFulfill || showArztFulfill)) {
            void applyStatus("OFFEN");
        }
    };

    const layer = (
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label={t("common.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="termin-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="termin-drawer-body-scroll">
                    <div className="termin-drawer-head">
                        <span className={`pill ${aufgabeStatusPillClass(aufgabe.status)}`}>
                            {aufgabeStatusLabel(aufgabe.status)}
                        </span>
                        <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                            <XIcon size={18} />
                        </button>
                    </div>

                    <div className="termin-drawer-section">
                        <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_eyebrow")}</div>
                        <h2 id={titleId} className="termin-drawer-title">
                            {aufgabe.titel}
                        </h2>
                        <div className="termin-drawer-sub">
                            {patientName} · {aufgabeTypLabel(aufgabe.typ)}
                        </div>
                    </div>

                    <div className="termin-drawer-meta-row">
                        <div>
                            <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_created")}</div>
                            <div className="termin-drawer-meta-val">
                                {format(parseISO(aufgabe.created_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div>
                            <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_updated")}</div>
                            <div className="termin-drawer-meta-val">
                                {format(parseISO(aufgabe.updated_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div>
                            <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_assignee")}</div>
                            <div className="termin-drawer-meta-val">{assigneeLabel(aufgabe, personal)}</div>
                        </div>
                    </div>

                    <div className="termin-drawer-section">
                        <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_workflow")}</div>
                        <div className="termin-workflow-simple">
                            {AUFGABE_WORKFLOW_STEPS.map((step, i) => {
                                const Icon = WORKFLOW_ICONS[i] ?? CheckIcon;
                                const isNext =
                                    canValidate &&
                                    aufgabe.status === "ERLEDIGT_REZEPTION" &&
                                    step.status === "VALIDIERT";
                                return (
                                    <button
                                        key={step.status}
                                        type="button"
                                        className={[
                                            "termin-workflow-node",
                                            i <= active ? "on" : "",
                                            i === active ? "current" : "",
                                            isNext ? "termin-workflow-node--next" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        title={step.label}
                                        disabled={busy || !canClickWorkflowStep(i)}
                                        onClick={() => onWorkflowStep(i)}
                                    >
                                        <Icon size={14} />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="termin-workflow-captions">
                            {AUFGABE_WORKFLOW_STEPS.map((step) => (
                                <span key={step.status} className="termin-workflow-label">
                                    {step.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_patient")}</div>
                            <div className="termin-drawer-meta-val">{patientName}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.drawer_creator")}</div>
                            <div className="termin-drawer-meta-val">{creatorLabel}</div>
                        </div>
                        {aufgabe.leistungsname || aufgabe.gesamtkosten != null ? (
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">{t("page.praxis_tickets.leistung_fallback")}</div>
                                <div className="termin-drawer-meta-val">
                                    {aufgabe.leistungsname ?? t("page.praxis_tickets.leistung_fallback")}
                                    {aufgabe.gesamtkosten != null ? ` · ${aufgabe.gesamtkosten.toFixed(2)} €` : ""}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <PraxisAufgabeKommentare aufgabe={aufgabe} personal={personal} active canComment={canComment} />

                    {canComplete ? (
                        <div className="praxis-aufgabe-drawer-inline">
                            <Input
                                label={t("page.praxis_tickets.aufgabe_notiz_label")}
                                value={completeNote}
                                onChange={(e) => setCompleteNote(e.target.value)}
                                placeholder={t("page.praxis_tickets.aufgabe_notiz_placeholder")}
                            />
                        </div>
                    ) : null}

                    {showReturnForm ? (
                        <div className="praxis-aufgabe-drawer-inline">
                            <Textarea
                                label={t("page.praxis_tickets.aufgabe_return_reason")}
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                            />
                        </div>
                    ) : null}

                    <div className="termin-drawer-actions row">
                        {aufgabe.patient_id?.trim() ? (
                            <button
                                type="button"
                                className="btn btn-subtle"
                                onClick={() => navigate(`/patienten/${aufgabe.patient_id}`)}
                            >
                                {t("page.praxis_tickets.open_akte")}
                            </button>
                        ) : null}
                        {onEdit ? (
                            <button type="button" className="btn btn-subtle" onClick={onEdit}>
                                <EditIcon size={14} />
                                {tx("page.praxis_tickets.drawer_edit")}
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="termin-drawer-panel-foot">
                    <div className="termin-drawer-footer row">
                        {canTake ? (
                            <button
                                type="button"
                                className="btn btn-accent"
                                disabled={busy}
                                onClick={() => void applyStatus("IN_BEARBEITUNG")}
                            >
                                {t("page.praxis_tickets.aufgabe_take")}
                            </button>
                        ) : null}
                        {canComplete ? (
                            <button
                                type="button"
                                className="btn btn-accent"
                                disabled={busy}
                                onClick={() => {
                                    const note = completeNote.trim() || (aufgabe.body ?? aufgabe.titel).trim();
                                    void applyStatus("ERLEDIGT_REZEPTION", { erledigtNotiz: note || undefined });
                                }}
                            >
                                {t("page.praxis_tickets.aufgabe_done")}
                            </button>
                        ) : null}
                        {canValidate ? (
                            <button
                                type="button"
                                className="btn btn-accent"
                                disabled={busy}
                                onClick={() => void applyStatus("VALIDIERT")}
                            >
                                {t("page.praxis_tickets.aufgabe_validate")}
                            </button>
                        ) : null}
                        {canValidate ? (
                            showReturnForm ? (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-subtle"
                                        disabled={busy}
                                        onClick={() => {
                                            setShowReturnForm(false);
                                            setReturnReason("");
                                        }}
                                    >
                                        {t("page.praxis_tickets.cancel")}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-subtle danger"
                                        disabled={busy || !returnReason.trim()}
                                        onClick={() => {
                                            void applyStatus("ZURUECK", {
                                                zurueckBegruendung: returnReason.trim(),
                                            });
                                        }}
                                    >
                                        {showRezValidate
                                            ? t("page.praxis_tickets.aufgabe_return_arzt")
                                            : t("page.praxis_tickets.aufgabe_return_send")}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-subtle danger"
                                    disabled={busy}
                                    onClick={() => setShowReturnForm(true)}
                                >
                                    {showRezValidate
                                        ? t("page.praxis_tickets.aufgabe_return_arzt")
                                        : t("page.praxis_tickets.aufgabe_return")}
                                </button>
                            )
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(layer, document.body);
}
