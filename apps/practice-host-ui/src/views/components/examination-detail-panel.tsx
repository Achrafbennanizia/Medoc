/**
 * Structured examination detail panel (V2 UI).
 * Currently unused — patient-detail-examination-tab renders inline detail instead.
 * Re-enable when the full tabbed ExaminationV1 composer ships.
 */
import type { Examination } from "@/models/types";
import { clinicalSummaryFromExamination } from "@/lib/examination";
import { useT, useTParams } from "@/lib/i18n";

export function ExaminationDetailPanel({ examination }: { examination: Examination }) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const { detail, diagnosis, plan, generalNote } = clinicalSummaryFromExamination(examination);

    if (!detail && examination.results?.trim() && !diagnosis && !plan && !generalNote) {
        return (
            <pre className="examination-detail-sheet__legacy">{examination.results}</pre>
        );
    }

    if (!detail) {
        return (
            <div className="examination-detail-sheet">
                <div className="examination-detail-sheet__grid examination-detail-sheet__grid--clinical">
                    <div className="examination-detail-sheet__cell examination-detail-sheet__cell--field">
                        <div className="examination-detail-sheet__label">{t("examination.composer.diagnosis")}</div>
                        <div className="examination-detail-sheet__value">
                            {diagnosis || t("patient.detail.tab.common.diagnosis_open")}
                        </div>
                    </div>
                </div>
                {generalNote ? (
                    <div className="examination-detail-sheet__cell">
                        <div className="examination-detail-sheet__label">{t("examination.composer.general_note")}</div>
                        <div className="examination-detail-sheet__value examination-detail-sheet__value--pre">
                            {generalNote}
                        </div>
                    </div>
                ) : (
                    <p className="examination-detail-sheet__empty">{t("patient.detail.tab.unter.no_structured_data")}</p>
                )}
            </div>
        );
    }

    const toothEntries = Object.entries(detail.toothNotes)
        .filter(([, n]) => n.trim())
        .sort(([a], [b]) => Number(a) - Number(b));

    return (
        <div
            className="examination-detail-sheet"
            style={{
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
                <div
                    style={{
                        fontSize: 11,
                        letterSpacing: "0.04em",
                        color: "var(--fg-3)",
                        textTransform: "uppercase",
                    }}
                >
                    {t("patient.detail.tab.unter.summary_title")}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>{diagnosis || emDash}</div>
                {plan ? (
                    <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>
                        <strong>{t("patient.detail.tab.unter.plan_prefix")}</strong> {plan}
                    </p>
                ) : null}
                {generalNote ? (
                    <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-line" }}>
                        <strong>{t("patient.detail.tab.unter.general_note_prefix")}</strong> {generalNote}
                    </p>
                ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ fontSize: 13 }}>
                <div
                    style={{
                        padding: 14,
                        borderBottom: "1px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                    }}
                >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.chief_complaint")}
                    </div>
                    <p style={{ margin: 0, whiteSpace: "pre-line" }}>{detail.chiefComplaint || emDash}</p>
                    {detail.painVas ? (
                        <div style={{ marginTop: 8, color: "var(--fg-3)" }}>
                            {tp("patient.detail.tab.unter.vas_line", {
                                vas: detail.painVas,
                                location: detail.painLocation || emDash,
                            })}
                        </div>
                    ) : null}
                </div>
                <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.extraoral")}
                    </div>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.extraoral.tmj")} {detail.extraoral.tmj || emDash}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.extraoral.lymph")} {detail.extraoral.lymphNodes || emDash}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.extraoral.asymmetry")} {detail.extraoral.asymmetry || emDash}
                    </p>
                </div>
                <div
                    style={{
                        padding: 14,
                        borderBottom: "1px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                    }}
                >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.intraoral")}
                    </div>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.intraoral.mucosa")} {detail.intraoral.mucosa || emDash}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.intraoral.tongue")} {detail.intraoral.tongue || emDash}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.intraoral.gingiva")} {detail.intraoral.gingiva || emDash}
                    </p>
                </div>
                <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.periodontal")}
                    </div>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.periodontal.psi")}{" "}
                        {Object.values(detail.psi).filter(Boolean).join(" / ") || emDash}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                        {tp("patient.detail.tab.unter.periodontal.metrics", {
                            bop: detail.bopPercent || emDash,
                            pi: detail.plaqueIndex || emDash,
                            mh: detail.hygieneScore || emDash,
                        })}
                    </p>
                </div>
                <div style={{ padding: 14, borderRight: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.function")}
                    </div>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.function.cmd")} {detail.function.cmd || emDash}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.function.bruxism")} {detail.function.bruxism || emDash}
                    </p>
                    <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.function.notes || ""}</p>
                </div>
                <div style={{ padding: 14, borderRight: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.tooth_notes")}
                    </div>
                    {toothEntries.length > 0 ? (
                        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                            {toothEntries.map(([tooth, note]) => (
                                <li key={tooth}>
                                    <strong>{tp("examination.composer.tooth_label", { tooth })}</strong>
                                    <span style={{ display: "block", marginTop: 2, whiteSpace: "pre-line" }}>{note}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p style={{ margin: 0 }}>{emDash}</p>
                    )}
                </div>
                <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", marginBottom: 6 }}>
                        {t("patient.detail.tab.unter.imaging")}
                    </div>
                    <p style={{ margin: "4px 0" }}>
                        {t("patient.detail.tab.unter.imaging.ordered")} {detail.imaging.ordered || emDash}
                    </p>
                    <p style={{ margin: "4px 0", whiteSpace: "pre-line" }}>{detail.imaging.findings || emDash}</p>
                </div>
            </div>
        </div>
    );
}
