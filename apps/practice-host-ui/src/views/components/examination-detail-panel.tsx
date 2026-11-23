/**
 * Examination detail: every field of the structured ExaminationV1 record, read-only.
 * Labels reuse the composer's keys so the form and the detail say the same thing.
 */
import type { ReactNode } from "react";
import type { Examination } from "@/models/types";
import { clinicalSummaryFromExamination } from "@/lib/examination";
import { dentalStatusLabel, findingToStatusKeys, formatDentalToothLabel, sortFdiTeeth } from "@/lib/dental";
import { useT, useTParams } from "@/lib/i18n";

type Row = [label: string, value: string];

export function ExaminationDetailPanel({ examination }: { examination: Examination }) {
    const t = useT();
    const tp = useTParams();
    const emDash = t("common.em_dash");
    const { detail, diagnosis, plan, generalNote } = clinicalSummaryFromExamination(examination);
    const c = (key: string) => t(`examination.composer.${key}`);

    if (!detail) {
        return examination.results?.trim() && !diagnosis && !generalNote ? (
            <pre className="examination-detail-sheet__legacy">{examination.results}</pre>
        ) : (
            <div className="examination-detail-sheet">
                <Summary title={t("patient.detail.tab.examination.summary_title")} diagnosis={diagnosis || emDash} plan="" note={generalNote} t={t} />
            </div>
        );
    }

    const psi = (["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((s, i) => [
        tp("examination.composer.sextant", { n: i + 1 }),
        detail.psi[s],
    ]) as Row[];
    const teeth = sortFdiTeeth([...Object.keys(detail.toothNotes), ...Object.keys(detail.toothStatuses)]);

    return (
        <div className="examination-detail-sheet">
            <Summary title={t("patient.detail.tab.examination.summary_title")} diagnosis={diagnosis || emDash} plan={plan} note={generalNote} t={t} />
            <div className="examination-detail-sheet__grid examination-detail-sheet__grid--clinical examination-detail-sheet__grid--full">
                <Cell title={c("section_haupt")}>
                    <Rows
                        empty={emDash}
                        rows={[
                            [c("chief"), detail.chiefComplaint],
                            [c("pain_vas"), detail.painVas ? `${detail.painVas}/10` : ""],
                            [c("pain_location"), detail.painLocation],
                        ]}
                    />
                </Cell>
                <Cell title={c("section_extra")}>
                    <Rows
                        empty={emDash}
                        rows={[
                            [c("tmj"), detail.extraoral.tmj],
                            [c("lymph"), detail.extraoral.lymphNodes],
                            [c("asymmetry"), detail.extraoral.asymmetry],
                            [c("muscles"), detail.extraoral.muscles],
                        ]}
                    />
                </Cell>
                <Cell title={c("section_intra")}>
                    <Rows
                        empty={emDash}
                        rows={[
                            [c("mucosa"), detail.intraoral.mucosa],
                            [c("tongue"), detail.intraoral.tongue],
                            [c("gingiva"), detail.intraoral.gingiva],
                            [c("salivary"), detail.intraoral.salivary],
                        ]}
                    />
                </Cell>
                <Cell title={c("section_paro")}>
                    <Rows
                        empty={emDash}
                        rows={[...psi, [c("bop"), detail.bopPercent], [c("plaque"), detail.plaqueIndex], [c("hygiene"), detail.hygieneScore]]}
                    />
                </Cell>
                <Cell title={c("section_funk")}>
                    <Rows
                        empty={emDash}
                        rows={[
                            [c("cmd"), detail.function.cmd],
                            [c("bruxism"), detail.function.bruxism],
                            [c("splint"), detail.function.splint],
                            [c("function_notes"), detail.function.notes],
                        ]}
                    />
                </Cell>
                <Cell title={c("section_rx")}>
                    <Rows
                        empty={emDash}
                        rows={[
                            [c("imaging_ordered"), detail.imaging.ordered],
                            [c("imaging_note"), detail.imaging.findings],
                        ]}
                    />
                </Cell>
            </div>
            <div className="examination-detail-sheet__cell examination-detail-sheet__cell--teeth">
                <div className="examination-detail-sheet__label">{c("documented_teeth")}</div>
                {teeth.length ? (
                    <ul className="examination-detail-sheet__tooth-list">
                        {teeth.map((tooth) => (
                            <li key={tooth}>
                                <strong>{formatDentalToothLabel(tooth, t)}</strong>
                                {detail.toothStatuses[tooth]
                                    ? findingToStatusKeys(detail.toothStatuses[tooth]).map((k) => (
                                          <span key={k} className={`dental-arch__pill is-${k} examination-detail-sheet__pill`}>
                                              {dentalStatusLabel(t, k)}
                                          </span>
                                      ))
                                    : null}
                                <span className="examination-detail-sheet__tooth-note">{detail.toothNotes[tooth] || emDash}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="examination-detail-sheet__value">{emDash}</p>
                )}
            </div>
        </div>
    );
}

function Summary({ title, diagnosis, plan, note, t }: { title: string; diagnosis: string; plan: string; note: string; t: (k: string) => string }) {
    return (
        <div className="examination-detail-sheet__summary">
            <div className="examination-detail-sheet__label">{title}</div>
            <div className="examination-detail-sheet__diagnosis">{diagnosis}</div>
            {plan ? (
                <p>
                    <strong>{t("patient.detail.tab.examination.plan_prefix")}</strong> {plan}
                </p>
            ) : null}
            {note ? (
                <p>
                    <strong>{t("patient.detail.tab.examination.general_note_prefix")}</strong> {note}
                </p>
            ) : null}
        </div>
    );
}

function Cell({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="examination-detail-sheet__cell">
            <div className="examination-detail-sheet__label">{title}</div>
            {children}
        </div>
    );
}

function Rows({ rows, empty }: { rows: Row[]; empty: string }) {
    return (
        <dl className="examination-detail-sheet__rows">
            {rows.map(([label, value]) => (
                <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value.trim() || empty}</dd>
                </div>
            ))}
        </dl>
    );
}
