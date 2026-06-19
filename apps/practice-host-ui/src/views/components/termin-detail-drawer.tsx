import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import type { Termin } from "@/models/types";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import {
    appointmentStateDisplay,
    minutesToUhrzeit,
    stateSoftPillClass,
    terminArtLabelFromTermin,
    TERMIN_DEFAULT_DUR_MIN,
    uhrzeitToMinutes,
} from "@/lib/termin-calendar-ui";
import {
    BoltIcon,
    CheckIcon,
    EditIcon,
    EyeIcon,
    MailIcon,
    PhoneIcon,
    ShieldCheckIcon,
    XIcon,
} from "@/lib/icons";

function terminDrawerActiveStep(status: Termin["status"]): number {
    if (status === "DURCHGEFUEHRT") return 3;
    if (status === "BESTAETIGT") return 1;
    if (status === "GEPLANT") return 0;
    if (status === "ABGESAGT" || status === "NICHT_ERSCHIENEN") return -1;
    return 0;
}

export type TerminDetailDrawerProps = {
    termin: Termin;
    patientName: string;
    patientPhone: string | null;
    doctorLabel: string;
    onClose: () => void;
    onBearbeiten: () => void;
    onStornieren: () => void;
    onReminder: () => void;
    onStatusChange: (id: string, s: Termin["status"]) => void;
    onPhone: () => void;
};

export function TerminDetailDrawer({
    termin,
    patientName,
    patientPhone,
    doctorLabel,
    onClose,
    onBearbeiten,
    onStornieren,
    onReminder,
    onStatusChange,
    onPhone,
}: TerminDetailDrawerProps) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const st = appointmentStateDisplay(termin);
    const active = terminDrawerActiveStep(termin.status);
    const dauer = TERMIN_DEFAULT_DUR_MIN;

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
            const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>(".termin-drawer-head .icon-btn");
            closeBtn?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const layer = (
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label={t("termin.drawer.close")} onClick={onClose} />
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
                        <span className={`pill ${stateSoftPillClass(termin)}`}>{st.label}</span>
                        <button type="button" className="icon-btn" aria-label={t("termin.drawer.close")} onClick={onClose}>
                            <XIcon size={18} />
                        </button>
                    </div>
                    <div className="termin-drawer-section">
                        <div className="termin-drawer-eyebrow">{t("termin.drawer.appointment")}</div>
                        <h2 id={titleId} className="termin-drawer-title">{patientName}</h2>
                        <div className="termin-drawer-sub">{terminArtLabelFromTermin(termin)}</div>
                    </div>
                    <div className="termin-drawer-meta-row">
                        <div>
                            <div className="termin-drawer-eyebrow">{t("termin.drawer.date")}</div>
                            <div className="termin-drawer-meta-val">{format(parseISO(termin.datum), "d. MMMM yyyy", { locale: dateFnsLocale })}</div>
                        </div>
                        <div>
                            <div className="termin-drawer-eyebrow">{t("termin.drawer.time")}</div>
                            <div className="termin-drawer-meta-val">
                                {termin.uhrzeit.slice(0, 5)} – {minutesToUhrzeit(uhrzeitToMinutes(termin.uhrzeit) + dauer)}
                            </div>
                        </div>
                        <div>
                            <div className="termin-drawer-eyebrow">{t("termin.drawer.duration")}</div>
                            <div className="termin-drawer-meta-val">{tp("termin.drawer.duration_min", { min: dauer })}</div>
                        </div>
                    </div>
                    <div className="termin-drawer-section">
                        <div className="termin-drawer-eyebrow">{t("termin.drawer.workflow")}</div>
                        <div className="termin-workflow-simple">
                            {([
                                t("termin.drawer.workflow.planned"),
                                t("termin.drawer.workflow.confirmed"),
                                t("termin.drawer.workflow.active"),
                                t("termin.drawer.workflow.done"),
                            ] as const).map((label, i) => (
                                <button
                                    key={label}
                                    type="button"
                                    className={`termin-workflow-node ${i <= active ? "on" : ""} ${i === active ? "current" : ""}`}
                                    title={label}
                                    onClick={() => {
                                        const map: Termin["status"][] = ["GEPLANT", "BESTAETIGT", "BESTAETIGT", "DURCHGEFUEHRT"];
                                        onStatusChange(termin.id, map[i]!);
                                    }}
                                >
                                    {i === 0 ? <CheckIcon size={14} /> : i === 1 ? <EyeIcon size={14} /> : i === 2 ? <BoltIcon size={14} /> : <ShieldCheckIcon size={14} />}
                                </button>
                            ))}
                        </div>
                        <div className="termin-workflow-captions">
                            {([
                                t("termin.drawer.workflow.planned"),
                                t("termin.drawer.workflow.confirmed"),
                                t("termin.drawer.workflow.active"),
                                t("termin.drawer.workflow.done"),
                            ] as const).map((label) => (
                                <span key={label} className="termin-workflow-label">{label}</span>
                            ))}
                        </div>
                    </div>
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("termin.drawer.provider")}</div>
                            <div className="termin-drawer-meta-val">{doctorLabel}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("termin.drawer.patient_phone")}</div>
                            <div className="termin-drawer-meta-val">{patientPhone ?? "—"}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("termin.drawer.treatment_type")}</div>
                            <div className="termin-drawer-meta-val">{terminArtLabelFromTermin(termin)}</div>
                        </div>
                    </div>
                    {termin.notizen?.trim() ? (
                        <div className="termin-drawer-note">
                            <div className="termin-drawer-note-title">{t("termin.drawer.note")}</div>
                            <p>{termin.notizen}</p>
                        </div>
                    ) : null}
                    <div className="termin-drawer-actions row">
                        <button type="button" className="btn btn-subtle" onClick={onPhone}>
                            <PhoneIcon size={14} />
                            {t("termin.drawer.call")}
                        </button>
                        <button type="button" className="btn btn-subtle" onClick={onReminder}>
                            <MailIcon size={14} />
                            {t("termin.drawer.reminder")}
                        </button>
                        <button type="button" className="btn btn-subtle" onClick={onBearbeiten}>
                            <EditIcon size={14} />
                            {t("termin.drawer.edit")}
                        </button>
                    </div>
                </div>
                <div className="termin-drawer-panel-foot">
                    <div className="termin-drawer-footer row">
                        {termin.status === "GEPLANT" ? (
                            <button type="button" className="btn btn-accent" onClick={() => onStatusChange(termin.id, "BESTAETIGT")}>{t("termin.drawer.confirm")}</button>
                        ) : null}
                        {termin.status === "BESTAETIGT" ? (
                            <button type="button" className="btn btn-accent" onClick={() => onStatusChange(termin.id, "DURCHGEFUEHRT")}>{t("termin.drawer.finish")}</button>
                        ) : null}
                        <button type="button" className="btn btn-subtle danger" onClick={onStornieren}>{t("termin.drawer.cancel")}</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(layer, document.body);
}
